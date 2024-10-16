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
  // Returns the data as a string of hexadecimal like 0A.
  function data_str(data) {
    return Array.from(data).map(n => n.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  }

  const octave_notes = [
    "C", "C#",
    "D", "D#",
    "E",
    "F", "F#",
    "G", "G#",
    "A", "A#",
    "B",
  ];
  
  // Returns the MIDI note name base on the note byte of the MIDI event.
  function note_name(note_byte) {
    if (note_byte < 0) {
      return note_byte.toString();
    }
    const offset = note_byte % 12;
    const octave = ((note_byte - offset) / 12) - 1;
    return `${octave_notes[offset]}${octave}`
  }

  // Returns the string version of the input MIDI data.
  function format_midi_data(data) {
    if (data.length === 0) {
      return "<empty>";
    }

    const status_byte = data[0];
    const message_type = status_byte & 0xf0;
    const channel = (message_type !== 0xF0
                     ? (status_byte & 0xf) + 1
                     : 0);
    switch (message_type) {
    case 0x90:        // Note On
      if (data.length !== 3) { return data_str(data); }
      return `[${channel}] note-on  ${note_name(data[1])} v:${data[2]}`;
    case 0x80:        // Note Off
      if (data.length !== 3) { return data_str(data); }
      return `[${channel}] note-off ${note_name(data[1])} v:${data[2]}`;
    case 0xA0:        // Poly Key pressure
      if (data.length !== 3) { return data_str(data); }
      return `[${channel}] poly-key-pressure ${note_name(data[1])} p:${data[2]}`
    case 0xB0:        // Control Change
      if (data.length !== 3) { return data_str(data); }
      return `[${channel}] control-change c:${data[1]} v:${data[2]}`;
    case 0xC0:        // Program Change
      if (data.length !== 2) {
        return data_str(data);
      }
      return `[${channel}] program-change ${data[1]}`;
    case 0xD0:        // Channel pressure
      if (data.length !== 2) { return data_str(data); }
      return `[${channel}] channel-pressure p:${data[1]}`;
    case 0xE0:        // Pitch Bend
      {
        if (data.length !== 3) { return data_str(data); }
        const bend = ((data[2] << 7) | data[1]) - 0x2000;
        return `[${channel}] pitch-bend b:${bend}`;
      }
    default:
      return data_str(data);
    }
  }
  
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
          add_to_log(`ignoring event ${format_midi_data(data)} since the mirrored note ${n} is out of range`)
          return;
        }
        data[1] = n;
        if (log_midi_events_input.checked) {
          add_to_log(`MIDI event: ${format_midi_data(e.data)} → ${format_midi_data(data)}`);
        }
        break;
      default:
        if (log_midi_events_input.checked) {
          add_to_log(`MIDI event: ${format_midi_data(data)}`);
        }
        break;
      }
      try {
        this.out_port.send(data);
      } catch (err) {
        add_to_log(`ERROR: sending MIDI to the output failed, ${err}`);
      }
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
  let state = null;
  const input_sel = document.getElementById("input-sel");
  const output_sel = document.getElementById("output-sel");
  const disable_local_control = document.getElementById("disable-local-control")
  const enable_local_control = document.getElementById("enable-local-control")
  const log = document.getElementById("log");
  const clear_log_button = document.getElementById("clear-log");
  const log_midi_events_input = document.getElementById("log-midi-events");
  const input_port_key = "input_port";
  const output_port_key = "output_port";
  const log_midi_events_key = "log_midi_events";

  // Add the given message at the top of the log.
  function add_to_log(msg) {
    const now = new Date();
    const Y = now.getFullYear();
    const M = now.getMonth().toString().padStart(2, "0");
    const D = now.getDate().toString().padStart(2, "0");
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    const s = now.getSeconds().toString().padStart(2, "0");
    const ms = now.getMilliseconds().toString().padStart(3, "0");
    const timestamp = `${Y}-${M}-${D} ${h}:${m}:${s}.${ms}`;
    const log_line_text = document.createTextNode(`[${timestamp}] ${msg}`);
    const log_line = document.createElement("span");
    log_line.className = "log-msg";
    log_line.appendChild(log_line_text);
    log.insertBefore(document.createElement("br"), log.firstChild);
    log.insertBefore(log_line, log.firstChild);
  }

  // Remove all messages from the log.
  function clear_log() {
    while (log.lastChild !== null) {
      log.removeChild(log.lastChild);
    }
  }

  function set_local_control(on) {
    var out_port = state.access.outputs.get(output_sel.value);
    if (out_port === undefined) {
      add_to_log(`ERROR: no output device selected!`);
      return;
    }

    var data = new Uint8Array(3);
    data[0] = 0xb0;             // Mode message.
    data[1] = 122;              // Local Control.
    data[2] = on ? 127 : 0;     // On or Off.
    add_to_log(`sending ${format_midi_data(data)} to try changing Local Control`)
    try {
      out_port.send(data);
    } catch (err) {
      add_to_log(`ERROR: sending MIDI to the output failed, ${err}`);
    }
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
        "click", set_local_control.bind(null, false));
      enable_local_control.addEventListener(
        "click", set_local_control.bind(null, true));

      // Bind click event for log.
      clear_log_button.addEventListener("click", clear_log);
      // Set the value of log MIDI events and add a listener on
      // changes.
      log_midi_events_input.addEventListener(
        "change",
        e => localStorage.setItem(log_midi_events_key,
                                  log_midi_events_input.checked.toString())
      );
      if (localStorage.getItem(log_midi_events_key) === "true") { 
        log_midi_events_input.checked = true;
      }
      
      // Listen to connections & disconnections of MIDI ports.
      access.onstatechange = function(e) {
        console.log("state change:", midi_port_json(e.port));
        // If the disconnected port is one of the filter, remove the
        // filter.
        if (e.port.state === "disconnected" &&
            state.filter !== null &&
            (state.filter.in_port.id === e.port.id ||
             state.filter.out_port.id === e.port.id)) {
          add_to_log(`port ${e.port.name} disconnected!`);
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
            add_to_log(`port ${e.port.name} reconnected!`);
          }
        }
      };
    });
})()
