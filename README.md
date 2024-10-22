# web-midi-mirror

This web application mirrors a MIDI keyboard so that low-pitch keys are on the right hand side of the keyboard and high-pitch keys are on the left hand side.

It is based on [WebMIDI](https://developer.mozilla.org/en-US/docs/Web/API/MIDIAccess#Browser_compatibility) which is, as of today (2019-06), only supported by Chrome.

## Compilation

This project is written in TypeScript. It thus needs to be compilated.

### TypeScript Compilation

With the current directory at the root of the repository, run:

* `npm install`: Install the TypeScript dependencies.
* `tsc`: Runs the TypeScript compiler.

This will create the `scripts/` folder that contains the compiled
JavaScript files from the TypeScript files in `src/`.

### Running Locally

You need a web-server to be able to use WebMidi. The simplest one is
the one included in Python. Simply run:

`python3 -m http.server`

This will run an HTTP server on port 8000 of all IP addresses of the
machine. You can then visit http://127.0.0.1:8000 to access it.

## Usage

In _input_ combobox select the input port corresponding to your MIDI keyboard.

In _output_ combobox select the MIDI output port corresponding to the MIDI instrument used to generate sounds.

If you are using a digital piano then _input_ and _output_ may point to the same instrument.  
To prevent the instrument from generating two notes for each key, the usual note and the mirrored note, **you need to disable the instrument's _Local Control_**. Usually this is available in the instrument's menu.  
On some instruments the local control can be disabled by sending a MIDI event. If this is the case then pressing the _Disable_ button in this application will disable it.  
For other instruments you will have to use the instruments' buttons to disable the local control.

## License

Copyright (C) 2019 Stéphane SOPPERA.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
