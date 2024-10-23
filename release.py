from typing import Optional
import subprocess, sys, itertools, argparse, os, tempfile, shutil


def is_git_clean(root: str) -> Optional[str]:
    """Returns None if Git is clean, else the reason for non-cleanness."""
    p = subprocess.run(('git', 'status', '--porcelain=2', '--branch'),
                       check=True,
                       stdout=subprocess.PIPE,
                       cwd=root)
    lines = p.stdout.split(b'\n')
    header_lines, content_lines = tuple(tuple(i) for (_, i) in itertools.groupby(lines, key=lambda line: line.startswith(b'#')))
    content_lines = tuple(l for l in content_lines if l)
    (ab_header,) = (l for l in header_lines if l.startswith(b'# branch.ab '))
    (_, _, ahead, behind) = ab_header.split(b' ')

    if content_lines:
        return f'there are some local changes in the repository:\n{content_lines!r}'

    if ahead != b'+0':
        return 'there are some unpushed changes in the repository'

    # TODO: check the tag
        
    return None


def main() -> None:
    parser = argparse.ArgumentParser('Release the website to the `release` Git branch.')
    parser.add_argument('--no-check-git', dest='check_git',
                        action='store_false',
                        help='disable the check of the git status')
    args = parser.parse_args()

    # First make sure we find the Git directory.
    root_dir = os.path.dirname(os.path.abspath(__file__))
    git_dir = os.path.join(root_dir, '.git')
    if not os.path.exists(git_dir):
        print(f'ERROR: {git_dir!r} does not exists', file=sys.stderr)
        sys.exit(1)

    # Check that Git is clean.
    if args.check_git:
        opt_err = is_git_clean(root_dir)
        if opt_err is not None:
            print(f'ERROR: {opt_err}', file=sys.stderr)
            sys.exit(1)

    # Switch to `master` branch.
    print(f'\n** Switch to the `master` branch…', flush=True)
    subprocess.run(('git', 'switch', 'master'), check=True, cwd=root_dir)

    # Get the Git commit hash.
    print(f'\n** Getting current revision…', flush=True)
    revision = subprocess.run(('git', 'rev-parse', 'HEAD'),
                              check=True,
                              stdout=subprocess.PIPE, encoding='utf-8',
                              cwd=root_dir).stdout.strip()
    print(f'Revision: {revision!r}')

    # Create the output in the temporary directory before doing the Git.
    with tempfile.TemporaryDirectory() as tmp_dir:
        make_args = ('make', f'OUTPUT_DIR={tmp_dir}')
        print(f'\n** Creating the output in {tmp_dir!r} running {make_args} in {root_dir!r}…', flush=True)
        subprocess.run(make_args, check=True, cwd=root_dir)

        print(f'\n** Switch to the `release` branch…', flush=True)
        subprocess.run(('git', 'switch', 'release'), check=True, cwd=root_dir)

        print(f'\n** Updating the `release` directory (only creating/updating files, not deleting!)…', flush=True)
        shutil.copytree(tmp_dir, root_dir, dirs_exist_ok=True)

        print(f'\n** Add all files…', flush=True)
        for dirpath, _, filenames in os.walk(tmp_dir):
            for filename in filenames:
                filepath = os.path.relpath(os.path.join(dirpath, filename), tmp_dir)
                print(f'\n * adding {filepath}')
                subprocess.run(('git', 'add', filepath), check=True, cwd=root_dir)

        print(f'\n** Creating the commit…', flush=True)
        subprocess.run(('git', 'commit', '-m', f'Updating release from {revision}.'),
                       check=True, cwd=root_dir)


if __name__ == '__main__':
    main()
