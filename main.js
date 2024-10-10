/*
 * Copyright (C) 2019 Stéphane SOPPERA.
 *
 * This file is part of web-midi-mirror.
 * 
 * Web-midi-mirror is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 * 
 * Web-midi-mirror is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License along
 * with web-midi-mirror. If not, see <https://www.gnu.org/licenses/>.
 */
"use strict";

(function() {
  // A filter that redirects all event received from `in_port`
  // `MIDIInput` to `out_port` `MIDIOutput`, mirror the note of note
  // on/off events.
  //
  // When instantiated it will listen to the `in_port` `midimessage`
  // event. The caller must call `disconnect()` to remove the
  // listeners.
  class Filter {
    constructor(in_port, out_port) {
      this.in_port = in_port;
      this.out_port = out_port;
      // We need to keep the listeners references so that we can remove
      // them in `disconnect()`. It will be reset to null after
      // disconnection.
      this.midimessage_listener = this.onmidimessage.bind(this);
      this.in_port.addEventListener("midimessage", this.midimessage_listener);
    }

    // Removes the listener from the in_port to stop redirecting events
    // to out_port and returns the notes currently on.
    //
    // Throws an error if called multiple times.
    disconnect() {
      if (this.midimessage_listener === null) {
        throw new Error("already disconnnected")
      }
      this.in_port.removeEventListener("midimessage", this.midimessage_listener);
      this.midimessage_listener = null;
    }

    // Sends to the `out_port` the message, transforming notes events.
    onmidimessage(e) {
      if (this.midimessage_listener === null) {
        throw new Error("disconnected");
      }
      let data = e.data;
      switch (data[0] & 0xf0) {
      case 0x90:        // note on
      case 0x80:        // note off
        data = new Uint8Array(data);
        let n = 124 - data[1];
        if (n < 0) {
          console.log("ignoring out of range note:", n,
                      " (created from", data[1], ")");
          return;
        }
        data[1] = n;
        break;
      }
      this.out_port.send(data);
    }
  }

  // Returns a JS object with the data of a MIDIPort.
  function midi_port_json(p) {
    return {
      id: p.id,
      manufacturer: p.manufacturer,
      name: p.name,
      type: p.type,
      state: p.state,
      connection: p.connection,
    }
  }

  // Fill the `selector` `<select>` element with all ports in
  // `ports_map` (either `MIDIInputMap` or `MIDIOutputMap`).
  //
  // The `value` of each `<option>` is the id of the port (not its
  // name). The default selected option is the one stored for the
  // `local_storage_key` in the `localStorage`. If this value does not
  // exists in the `ports_map`, the "select a port" option is
  // selected.
  function fill_port_selector(selector, ports_map, local_storage_key) {
    // Cleanup existing options.
    while (selector.lastChild !== null) {
      selector.removeChild(selector.lastChild);
    }

    // Add the "no port selected" option.
    let opt = document.createElement("option");
    selector.appendChild(opt);
    opt.value = "";
    opt.innerText = "--- select a port ---";

    // Add an option for each port.
    for (let [k, p] of ports_map) {
      let opt = document.createElement("option");
      selector.appendChild(opt);
      opt.value = k;
      opt.innerText = p.name;
    }

    // Select the selected option.
    let pref = localStorage.getItem(local_storage_key);
    if (pref !== null && ports_map.has(pref)) {
      selector.value = pref;
    } else {
      selector.value = "";
    }
  }

  class State {
    // `access` is the MIDIAccess object.
    constructor(access) {
      // The current Filter.
      this.filter = null
      this.access = access;
    }
  }

  // The State. Set when MIDIAccess has been obtained.
  var state = null;
  var input_sel = document.getElementById("input-sel");
  var output_sel = document.getElementById("output-sel");
  var disable_local_control = document.getElementById("disable-local-control")
  var enable_local_control = document.getElementById("enable-local-control")
  const input_port_key = "input_port";
  const output_port_key = "output_port";

  function set_local_control(on) {
    var out_port = state.access.outputs.get(output_sel.value);
    var data = new Uint8Array(3);
    data[0] = 0xb0;             // Mode message.
    data[1] = 122;              // Local Control.
    data[2] = on ? 127 : 0;     // On or Off.
    out_port.send(data);
    console.log(data);
  }

  // Removes `state.filter` and replaces it with a new one based on
  // selected values of `input_set` and `output_sel`. If those have no
  // selected port or if the port does not exists, skip creating the
  // filter.
  function set_filter_from_sel() {
    if (state.filter !== null) {
      state.filter.disconnect();
      state.filter = null;
    }
    const in_port = state.access.inputs.get(input_sel.value);
    const out_port = state.access.outputs.get(output_sel.value);
    if (in_port !== undefined && out_port !== undefined) {
      state.filter = new Filter(in_port, out_port);
    }
  }

  function onselchange() {
    // Store in the `localStorage` the selected values.
    if (input_sel.value !== "") {
      localStorage.setItem(input_port_key, input_sel.value);
    }
    if (output_sel.value !== "") {
      localStorage.setItem(output_port_key, output_sel.value);
    }

    // Update the filter from the selection.
    set_filter_from_sel();
  }

  navigator.requestMIDIAccess()
    .then(function(access) {
      state = new State(access)

      // Fill the port selectors with current values.
      fill_port_selector(input_sel, access.inputs, input_port_key);
      fill_port_selector(output_sel, access.outputs, output_port_key);

      // Set the filter.
      set_filter_from_sel();

      // Listen to "change" event, which is only emitted from user
      // interactions, not from JS updates of <select>'s value.
      input_sel.addEventListener("change", onselchange);
      output_sel.addEventListener("change", onselchange);

      // Bind click events for the MIDI local control.
      disable_local_control.addEventListener(
        "click", set_local_control.bind(null, false))
      enable_local_control.addEventListener(
        "click", set_local_control.bind(null, true))

      // Listen to connections & disconnections of MIDI ports.
      access.onstatechange = function(e) {
        console.log("state change:", midi_port_json(e.port));
        // If the disconnected port is one of the filter, remove the
        // filter.
        if (e.port.state === "disconnected" &&
            state.filter !== null &&
            (state.filter.in_port.id === e.port.id ||
             state.filter.out_port.id === e.port.id)) {
          console.log("disconnected port is part of the filter; remove the filter");
          state.filter.disconnect();
          state.filter = null;
        }

        // Updates the port selectors if needed.
        switch (e.port.type) {
        case "input":
          fill_port_selector(input_sel, access.inputs, input_port_key);
          break;
        case "output":
          fill_port_selector(output_sel, access.outputs, output_port_key);
          break;
        }

        // Enable the filter for newly connected port if:
        // * we had no active filter,
        // * and the modified port is "connected" and is one of the
        //   selected port
        // * and the two selected ports exists.
        //
        // We do this **after** having called the fill_port_selector()
        // so that input_sel.value and output_sel.value are updated.
        if (state.filter === null &&
            e.port.state === "connected" &&
            (e.port.id === input_sel.value ||
             e.port.id === output_sel.value) &&
            input_sel.value !== "" &&
            output_sel.value !== "") {
          set_filter_from_sel();
          if (state.filter !== null) {
            console.log("connected port is part of the filter; add the filter");
          }
        }
      };
    });
})()
