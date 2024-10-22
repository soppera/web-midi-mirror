# Copyright (C) 2024 Stéphane SOPPERA.
#
# This file is part of web-midi-mirror.
#
# Web-midi-mirror is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by the
# Free Software Foundation, either version 3 of the License, or (at your
# option) any later version.
#
# Web-midi-mirror is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
# Public License for more details.
#
# You should have received a copy of the GNU General Public License along
# with web-midi-mirror. If not, see <https://www.gnu.org/licenses/>.

.PHONY: compile
compile:
	tsc

.PHONY: release
release:
	git checkout pages
	git merge master
	-git rm scripts
	tsc
	git add scripts
	git commit -m "Upload compiled scripts."

