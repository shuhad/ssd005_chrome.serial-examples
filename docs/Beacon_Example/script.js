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
  const notSupported = document.getElementById("notSupported");
  notSupported.classList.toggle("hidden", "serial" in navigator);
});

/**
 * @name connect
 * Opens a Web Serial connection to a serial device such as a Smart USB Dongle 2.0 and sets up the input and
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
  readLoop().catch((error) => {
    toggleUIConnected(false);
    port = null;
    log.textContent = "Dongle Disconnected!";
  });
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
  log.textContent = "Dongle Disconnected!";
}

/**
 * @name clickConnect
 * Click handler for the connect/disconnect button.
 * Checks if port != null
 * If true: Checks if any beacons is advertising and stops the advertsing if so. Then runs disconnect() and set toggleUIConnected to false.
 * if false: Runs connect() then set toggleUIConnected to true.
 */
async function clickConnect() {
  log.textContent = "";
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
 * Click handler for the iBeacon button.
 * Checks if an iBeacon is already running by checking the boolean isIbeaconAdv.
 * If isIbeaconAdv = true: Stops advertising, changes the button text and shows the Eddystone button. Finally sets isEddystoneAdv = false.
 * If isIbeaconAdv = false: Sets the advertising data to setup an iBeacon with a UUID and starts advertising.
 * Also changes button text and hides the Eddystone button. Finally sets isIbeaconAdv = true.
 */
function clickIbeacon() {
  console.log("IBEACON BUTTON PRESSED");

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
  }, 500); // Waiting half a bit to make sure each command will get through separately.

  butIbeacon.textContent = "Stop Beacon";
  butEddystone.classList.toggle("hidden", true);
  isIbeaconAdv = true;
}

/**
 * @name clickEddystone
 * Click handler for the Eddystone Beacon button.
 * Checks if an Eddystone beacon is already running by checking the boolean isEddystoneAdv.
 * If isEddystoneAdv = true: Stops advertising, changes the button text and shows the iBeacon button. Finally sets isEddystoneAdv = false.
 * If isEddystoneAdv = false: Sets the advertising data to setup an Eddystone beacon with a link to google.com and starts advertising.
 * Also changes button text and hides the iBeacon button. Finally sets isEddystoneAdv = true.
 */
function clickEddystone() {
  console.log("EDDYSTONE BUTTON PRESSED");
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
  }, 500); // Waiting half a bit to make sure each command will get through separately.

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
 * @name writeCmd
 * Gets a writer from the output stream and send the command to the Smart USB Dongle 2.0.
 * @param  {string} cmd command to send to the Smart USB Dongle 2.0
 */
function writeCmd(cmd) {
  // Write to output stream
  const writer = outputStream.getWriter();
  console.log("[SEND]", cmd);

  writer.write(cmd);
  writer.write("\r"); // Important to send a carriage return after a command
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

/**
 * @name toggleUIConnected
 * Toggles the butIbeacon & butEddystone buttons visable/hidden depending on if dongle is connected or not.
 * Also changes the text on butConnect depending on the action it actually will preform in the current state.
 * @param  {boolean} connected true if connected, false if disconnected.
 */
function toggleUIConnected(connected) {
  let lbl = "Connect";
  if (connected) {
    lbl = "Disconnect";
  }
  butIbeacon.classList.toggle("hidden", !connected);
  butEddystone.classList.toggle("hidden", !connected);
  butConnect.textContent = lbl;
}
