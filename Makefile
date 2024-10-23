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

OUTPUT_DIR=./output

.PHONY: all
all: compile $(OUTPUT_DIR)/index.html $(OUTPUT_DIR)/css/style.css

.PHONY: compile
compile:
	tsc --outDir $(OUTPUT_DIR)

$(OUTPUT_DIR)/index.html: src/index.html
	mkdir -p $(OUTPUT_DIR)
	cp src/index.html $(OUTPUT_DIR)/index.html

$(OUTPUT_DIR)/css/style.css: src/css/style.css
	mkdir -p $(OUTPUT_DIR)/css
	cp src/css/style.css $(OUTPUT_DIR)/css/style.css

.PHONY: clean
clean:
	rm -rf $(OUTPUT_DIR)

