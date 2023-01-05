// Global variables
const time_el = document.querySelector(".watch .time");
const start_btn = document.getElementById("start");
const stop_btn = document.getElementById("stop");
const reset_btn = document.getElementById("reset");
const countdown_btn = document.getElementById("countdown");
const up_btn = document.getElementById("uptime");
const down_btn = document.getElementById("downtime");
const mode_btn = document.getElementById("mode");
const stopwatch_btn = document.getElementById("stopwatch");

let seconds = 0;
let interval = null;
let mode = "stopwatch";
let cdinterval = 1;

// Event listeners
start_btn.addEventListener("click", start);
stop_btn.addEventListener("click", stop);
reset_btn.addEventListener("click", reset);
countdown_btn.addEventListener("click", countdown);
up_btn.addEventListener("click", uptime);
down_btn.addEventListener("click", downtime);
mode_btn.addEventListener("click", changetime);
stopwatch_btn.addEventListener("click", stopwatch);

function stop() {
  clearInterval(interval);
  interval = null;
}

function reset() {
  stop();
  seconds = 0;
  time_el.innerText = "00:00:00";
}

function timer() {
  if (mode == "stopwatch") {
    seconds++;
  } else if (mode == "countdown") {
    if (seconds > 0) {
      seconds--;
    }
  }
  // Format our time
  let hrs = Math.floor(seconds / 3600);
  let mins = Math.floor((seconds - hrs * 3600) / 60);
  let secs = seconds % 60;

  if (secs < 10) secs = "0" + secs;
  if (mins < 10) mins = "0" + mins;
  if (hrs < 10) hrs = "0" + hrs;

  time_el.innerText = `${hrs}:${mins}:${secs}`;

  if (mode == "countdown" && seconds == 0) {
    reset();
    alert("Time is UP!");
  }
}

function start() {
  console.log("start pressed");
  if (interval) {
    return;
  }

  interval = setInterval(timer, 1000);
}

function highlightText(id) {
  var element = document.getElementById(id);
  element.classList.add("text-danger");
  element.classList.add("highlightText");
}
highlightText("startText");
highlightText("stopText");
highlightText("resetText");
highlightText("stopwatchText");
function unhighlightText(id) {
  var element = document.getElementById(id);
  element.classList.remove("text-danger");
  element.classList.remove("highlightText");
}
function stopwatch() {
  reset();
  mode = "stopwatch";
  highlightText("stopwatchText");
  unhighlightText("countdownText");
  unhighlightText("upText");
  unhighlightText("downText");
  unhighlightText("modeText");
}

function countdown() {
  reset();
  mode = "countdown";
  unhighlightText("stopwatchText");
  highlightText("countdownText");
  highlightText("upText");
  highlightText("downText");
  highlightText("modeText");
}

function uptime() {
  if (mode == "countdown") {
    seconds = seconds + cdinterval;
  }

  // Format our time
  let hrs = Math.floor(seconds / 3600);
  let mins = Math.floor((seconds - hrs * 3600) / 60);
  let secs = seconds % 60;

  if (secs < 10) secs = "0" + secs;
  if (mins < 10) mins = "0" + mins;
  if (hrs < 10) hrs = "0" + hrs;

  time_el.innerText = `${hrs}:${mins}:${secs}`;
}

function downtime() {
  if (mode == "countdown") {
    seconds = seconds - cdinterval;
  }

  // Format our time
  let hrs = Math.floor(seconds / 3600);
  let mins = Math.floor((seconds - hrs * 3600) / 60);
  let secs = seconds % 60;

  if (secs < 10) secs = "0" + secs;
  if (mins < 10) mins = "0" + mins;
  if (hrs < 10) hrs = "0" + hrs;

  time_el.innerText = `${hrs}:${mins}:${secs}`;
}

function changetime() {
  if (cdinterval == 1) {
    cdinterval = 60;
  } else if (cdinterval == 60) {
    cdinterval = 3600;
  } else {
    cdinterval = 1;
  }
}
