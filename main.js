/*
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
  function Filter(in_port, out_port) {
    this.in_port = in_port;
    this.out_port = out_port;
    this.listener = null;
  }

  Filter.prototype.connect = function connect() {
    if (this.listener !== null) {
      throw new Error("already connected")
    }
    this.listener = this.onmidimessage.bind(this);
    this.in_port.addEventListener("midimessage", this.listener);
  };

  Filter.prototype.disconnect = function disconnect() {
    if (this.listener === null) {
      throw new Error("not connected")
    }
    this.in_port.removeEventListener("midimessage", this.listener);
    this.listener = null;
  };

  Filter.prototype.onmidimessage = function onmidimessage(e) {
    if (this.listener === null) {
      throw new Error("disconnected");
    }
    let data = e.data;
    switch (data[0] & 0xf0) {
    case 0x90:		// note on
    case 0x80:		// note off
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
  };

  function midi_port_json(p) {
    return {
      id: p.id,
      manufacturer: p.manufacturer,
      name: p.name,
      type: p.type,
    }
  }

  function fill_port_selector(selector, ports_map, local_storage_key) {
    for (let [k, p] of ports_map) {
      let opt = document.createElement("option");
      selector.appendChild(opt);
      opt.value = k;
      opt.innerText = p.name;
    }
    let pref = localStorage.getItem(local_storage_key);
    if (pref !== null && ports_map.has(pref)) {
      selector.value = pref;
    }
  }

  var filter = null;
  var inputs = null;
  var outputs = null;
  var input_sel = document.getElementById("input-sel");
  var output_sel = document.getElementById("output-sel");
  var disable_local_control = document.getElementById("disable-local-control")
  var enable_local_control = document.getElementById("enable-local-control")
  const input_port_key = "input_port";
  const output_port_key = "output_port";

  function set_local_control(on) {
    var out_port = outputs.get(output_sel.value);
	var data = new Uint8Array(3);
    data[0] = 0xb0;             // Mode message.
    data[1] = 122;              // Local Control.
    data[2] = on ? 127 : 0;     // On or Off.
    out_port.send(data);
    console.log(data);
  }

  function onselchange() {
    if (filter !== null) {
      filter.disconnect();
      filter = null;
    }

    localStorage.setItem(input_port_key, input_sel.value);
    localStorage.setItem(output_port_key, output_sel.value);

    filter = new Filter(inputs.get(input_sel.value), outputs.get(output_sel.value))
    filter.connect();
  }

  navigator.requestMIDIAccess()
    .then(function(access) {
	  inputs = access.inputs;
	  outputs = access.outputs;

	  fill_port_selector(input_sel, access.inputs, input_port_key);
	  fill_port_selector(output_sel, access.outputs, output_port_key);

	  onselchange()
	  input_sel.addEventListener("change", onselchange);
	  output_sel.addEventListener("change", onselchange);

      disable_local_control.addEventListener("click", set_local_control.bind(null, false))
      enable_local_control.addEventListener("click", set_local_control.bind(null, true))

	  access.onstatechange = function(e) {
	    console.log("state change:", e.port.name, e.port.manufacturer, e.port.state);
	  };
    });
})()
