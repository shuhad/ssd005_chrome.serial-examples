/*
 * @license
 * Getting Started with Web Serial Codelab (https://todo)
 * Copyright 2019 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */
"use strict";

let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;
let isIbeaconAdv = false;
let isEddystonesAdv = false;

const log = document.getElementById("log");
const butIbeacon = document.getElementById("butIbeacon");
const butEddystone = document.getElementById("butEddystone");
const butConnect = document.getElementById("butConnect");

document.addEventListener("DOMContentLoaded", () => {
  butIbeacon.addEventListener("click", clickIbeacon);
  butEddystone.addEventListener("click", clickEddystone);
  butConnect.addEventListener("click", clickConnect);

  // CODELAB: Add feature detection here.
  // CODELAB: Add feature detection here.
  const notSupported = document.getElementById("notSupported");
  notSupported.classList.toggle("hidden", "serial" in navigator);
});

/**
 * @name connect
 * Opens a Web Serial connection to a micro:bit and sets up the input and
 * output stream.
 */
async function connect() {
  // - Request a port and open a connection.
  port = await navigator.serial.requestPort();
  // - Wait for the port to open.
  await port.open({ baudrate: 9600 });

  const encoder = new TextEncoderStream();
  outputDone = encoder.readable.pipeTo(port.writable);
  outputStream = encoder.writable;

  let decoder = new TextDecoderStream();
  inputDone = port.readable.pipeTo(decoder.writable);
  inputStream = decoder.readable.pipeThrough(
    new TransformStream(new LineBreakTransformer())
  );

  reader = inputStream.getReader();
  readLoop();
}

/**
 * @name disconnect
 * Closes the Web Serial connection.
 */
async function disconnect() {
  // Close the input stream (reader).
  if (reader) {
    await reader.cancel();
    await inputDone.catch(() => {});
    reader = null;
    inputDone = null;
  }
  // Close the output stream.
  if (outputStream) {
    await outputStream.getWriter().close();
    await outputDone;
    outputStream = null;
    outputDone = null;
  }
  // Close the port.
  await port.close();
  port = null;
}

/**
 * @name clickConnect
 * Click handler for the connect/disconnect button.
 */
async function clickConnect() {
  if (port) {
    if (isEddystonesAdv || isIbeaconAdv) {
      writeCmd("AT+ADVSTOP");
      butIbeacon.textContent = "Make iBeacon";
      butEddystone.textContent = "Make Eddystone Beacon";
    }
    await disconnect();
    toggleUIConnected(false);
    return;
  }
  await connect();
  toggleUIConnected(true);
}

/**
 * @name clickIbeacon
 * Click handler for the connect/disconnect button.
 */
function clickIbeacon() {
  console.log("IBEACON BUTTON");

  if (isIbeaconAdv) {
    writeCmd("AT+ADVSTOP");
    butEddystone;
    butIbeacon.textContent = "Make iBeacon";
    butEddystone.classList.toggle("hidden", false);
    isIbeaconAdv = false;
    return;
  }
  writeCmd("AT+ADVDATAI=5f2dd896-b886-4549-ae01-e41acd7a354a0203010400");
  setTimeout(() => {
    writeCmd("AT+ADVSTART=0;200;3000;0;");
  }, 500);
  butIbeacon.textContent = "Stop Beacon";
  butEddystone.classList.toggle("hidden", true);
  isIbeaconAdv = true;
}

/**
 * @name clickEddystone
 * Click handler for the connect/disconnect button.
 */
function clickEddystone() {
  console.log("EDDYSTONE BUTTON");
  if (isEddystonesAdv) {
    writeCmd("AT+ADVSTOP");
    butEddystone.textContent = "Make Eddystone Beacon";
    butIbeacon.classList.toggle("hidden", false);
    isEddystonesAdv = false;
    return;
  }
  writeCmd("AT+ADVDATA=03:03:aa:fe 0d:16:aa:fe:10:00:03:67:6f:6f:67:6c:65:07");
  setTimeout(() => {
    writeCmd("AT+ADVSTART=0;200;3000;0;");
  }, 500);
  butIbeacon.classList.toggle("hidden", true);
  butEddystone.textContent = "Stop Beacon";
  isEddystonesAdv = true;
}

/**
 * @name readLoop
 * Reads data from the input stream and displays it on screen.
 */
async function readLoop() {
  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      log.textContent += value + "\n";
    }
    if (done) {
      console.log("[readLoop] DONE", done);
      reader.releaseLock();
      break;
    }
  }
}

/**
 * @name writeToStream
 * Gets a writer from the output stream and send the lines to the micro:bit.
 * @param  {...string} lines lines to send to the micro:bit
 */
function writeToStream(...lines) {
  // Write to output stream
  const writer = outputStream.getWriter();
  lines.forEach((line) => {
    console.log("[SEND]", line);
    writer.write(line + "\r");
  });
  writer.releaseLock();
}

/**
 * @name writeCmd
 * Gets a writer from the output stream and send the command to the ssd005 dongle.
 * @param  {string} cmd command to send to the ssd005 dongle
 */
function writeCmd(cmd) {
  // Write to output stream
  const writer = outputStream.getWriter();
  console.log("[SEND]", cmd);
  writer.write(cmd);
  writer.write("\r");

  writer.releaseLock();
}

/**
 * @name LineBreakTransformer
 * TransformStream to parse the stream into lines.
 */
class LineBreakTransformer {
  constructor() {
    // A container for holding stream data until a new line.
    this.container = "";
  }

  transform(chunk, controller) {
    // Handle incoming chunk
    this.container += chunk;
    const lines = this.container.split("\r\n");
    this.container = lines.pop();
    lines.forEach((line) => controller.enqueue(line));
  }

  flush(controller) {
    // Flush the stream.
    controller.enqueue(this.container);
  }
}

function toggleUIConnected(connected) {
  let lbl = "Connect";
  butIbeacon.classList.toggle("hidden", true);
  butEddystone.classList.toggle("hidden", true);
  if (connected) {
    butIbeacon.classList.toggle("hidden", false);
    butEddystone.classList.toggle("hidden", false);
    lbl = "Disconnect";
  }
  butConnect.textContent = lbl;
}
