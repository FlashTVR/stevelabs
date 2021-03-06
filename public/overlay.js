/**
 * This file is part of Stevelabs.
 *
 * @copyright (c) 2020, Steve Guidetti, https://github.com/stevotvr
 * @license MIT
 *
 * For full license information, see the LICENSE.txt file included with the source.
 */

'use strict';

/**
 * Socket
 */

if (config.alerts || config.sfx || config.tts || config.chat || config.trivia) {
  // Create the socket connection
  const socket = io('//' + window.location.host);

  // Socket connected event
  socket.on('connect', () => {
    console.log('connected to socket');
  });

  // Socket disconnected event
  socket.on('disconnect', () => {
    console.log('socket connection lost');
  });

  // New alert event
  socket.on('alert', (type, params, duration, videoVolume, soundVolume) => {
    addAlert(type, params, duration, videoVolume, soundVolume);
  });

  // New sfx event
  socket.on('sfx', (key, volume) => {
    addSound(key, volume);
  });

  socket.on('tts', (message) => {
    addTts(message);
  });

  socket.on('chat', (username, color, message) => {
    addChatMessage(username, color, message);
  });

  socket.on('trivia', (text) => {
    updateTrivia(text);
  });
}

/**
 * Alerts
 */

// Queue of events ready to be displayed
const queue = [];

/**
 * Add a new alert to the queue.
 *
 * @param {string} type The type of event
 * @param {object} params The event parameters
 * @param {int} duration The event duration in milliseconds
 * @param {int} videoVolume The audio level for the video element (0-100)
 * @param {int} soundVolume The audio level for the sound element (0-100)
 */
function addAlert(type, params, duration, videoVolume, soundVolume) {
  queue.push(() => showAlert(type, params, duration, videoVolume, soundVolume));

  console.log(type, params, duration, videoVolume, soundVolume);

  if (queue.length === 1) {
    runQueue();
  }
}

/**
 * Run the next function in the queue.
 */
function runQueue() {
  if (!queue.length) {
    return;
  }

  queue[0]();
}

/**
 * Remove an item from the queue and run it.
 */
function popQueue() {
  queue.shift();
  runQueue();
}

/**
 * Show an alert from the queue.
 *
 * @param {string} type The type of event
 * @param {object} params The event parameters
 * @param {int} duration The event duration in milliseconds
 * @param {int} videoVolume The audio level for the video element (0-100)
 * @param {int} soundVolume The audio level for the sound element (0-100)
 */
function showAlert(type, params, duration, videoVolume, soundVolume) {
  const alertElem = document.getElementById(type);
  if (!alertElem) {
    return;
  }

  const messageElems = alertElem.getElementsByTagName('p');
  if (messageElems && messageElems.length) {
    for (const key in params) {
      const elems = messageElems[0].getElementsByClassName(key);
      if (elems) {
        for (let i = 0; i < elems.length; i++) {
          elems[i].innerText = params[key];
        }
      }
    }
  }

  if (type === 'greet' || type === 'shoutout') {
    const imgElement = alertElem.getElementsByTagName('img');
    if (imgElement && imgElement.length) {
      imgElement[0].src = params.image;
      imgElement[0].onload = () => {
        alertElem.style.opacity = 1;
      }

      setTimeout(() => {
        imgElement[0].onload = null;
      }, Math.max(500, duration - 1000));
    } else {
      alertElem.style.opacity = 1;
    }
  } else {
    alertElem.style.opacity = 1;
  }

  setTimeout(() => {
    alertElem.style.opacity = 0;
    setTimeout(() => {
      popQueue();
    }, 1000);
  }, duration);

  const videoElems = alertElem.getElementsByTagName('video');
  if (videoElems && videoElems.length) {
    videoElems[0].currentTime = 0;
    videoElems[0].volume = videoVolume / 100;
    videoElems[0].play();
  }

  const audioElems = alertElem.getElementsByTagName('audio');
  if (audioElems && audioElems.length) {
    audioElems[0].currentTime = 0;
    audioElems[0].volume = soundVolume / 100;
    audioElems[0].play();
  }
}

/**
 * Overlays
 */

// The interval for the tips display in milliseconds
const tipInterval = 15000;

// The tips display
const tipsElem = document.getElementById('tips');
if (tipsElem && config.tips) {
  let index = 0;

  tipsElem.innerText = 'Loading tips...';
  tipsElem.style.opacity = 1;

  setInterval(() => {
    tipsElem.style.opacity = 0;
    setTimeout(() => {
      tipsElem.innerText = `TIP: ${config.tips[index++ % config.tips.length]}`;
      tipsElem.style.opacity = 1;
    }, 500);
  }, tipInterval);
}

// The stream countdown
const countdownElem = document.getElementById('countdown');
if (countdownElem && config.schedule) {
  const next = getNextScheduled(config.schedule, true);

  const musicElem = document.getElementById('music');
  if (musicElem) {
    musicElem.onloadedmetadata = () => {
      const diff = (next.date.getTime() - Date.now()) / 1000;
      musicElem.currentTime = musicElem.duration - (diff % musicElem.duration);
      musicElem.volume = config.countdown_audio_volume / 100;
      musicElem.play();
    };
  }

  setInterval(() => {
    const now = new Date();
    const diff = Math.floor((next.date.getTime() - now.getTime()) / 1000);

    let timeLeft = 'Soon...';
    if (diff >= 0) {
      timeLeft = Math.floor(diff / 60) + ':' + Number(diff % 60).toLocaleString('en-US', { minimumIntegerDigits: 2 });
    } else if (musicElem) {
      musicElem.loop = false;
    }

    countdownElem.innerHTML = `Starting: ${timeLeft}<br>Playing: ${next.game}`;
  }, 100);
}

// The next stream display
const nextStreamElem = document.getElementById('nextstream');
if (nextStreamElem && config.schedule) {
  const next = getNextScheduled(config.schedule);

  const dateOptions = {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  const dateFormatted = next.date.toLocaleDateString('en-US', dateOptions);

  nextStreamElem.innerHTML = `Next Stream:<br>${dateFormatted}<br>${next.game}`;
}

/**
 * Parse the dates in the schedule data.
 *
 * @param {array} schedule The schedule data
 * @param {boolean} useEnd Whether to use the end times of the streams
 */
function loadDates(schedule, useEnd) {

  const now = new Date();

  for (let i = schedule.length - 1; i >= 0; i--) {

    const date = new Date();

    const hour = useEnd ? schedule[i].hour + Math.floor(schedule[i].length / 60) : schedule[i].hour;
    const minute = useEnd ? schedule[i].minute + schedule[i].length % 60 : schedule[i].minute;

    if (now.getDay() > schedule[i].day || (now.getDay() == schedule[i].day && (now.getHours() > hour || (now.getHours() == hour && now.getMinutes() > minute)))) {
      date.setDate(now.getDate() + (7 - now.getDay() + schedule[i].day));
    } else {
      date.setDate(now.getDate() + (schedule[i].day - now.getDay()));
    }

    date.setHours(schedule[i].hour);
    date.setMinutes(schedule[i].minute);
    date.setSeconds(0);

    schedule[i].date = date;
    schedule[i].end = new Date(date.getTime() + (schedule[i].length * 60000));
  }
}

/**
 * Get the next scheduled stream.
 *
 * @param {array} schedule The schedule data
 * @param {boolean} useEnd Whether to use the end times of the streams
 */
function getNextScheduled(schedule, useEnd = false) {
  if (schedule[0].date === undefined) {
    loadDates(schedule, useEnd);
  }

  let next = schedule[0];

  for (let i = schedule.length - 1; i >= 0; i--) {
    if ((useEnd && schedule[i].end < next.end) || (!useEnd && schedule[i].date < next.date)) {
      next = schedule[i];
    }
  }

  return next;
}

/**
 * Sound effects
 */

/**
 * Add a new sound to the queue.
 *
 * @param {string} key The sound effect key
 * @param {int} volume The audio level (0-100)
 */
function addSound(key, volume) {
  queue.push(() => playSound(key, volume));

  console.log('sfx', key, volume);

  if (queue.length === 1) {
    runQueue();
  }
}

/**
 * Play a sound from the queue.
 *
 * @param {string} key The sound effect key
 * @param {int} volume The audio level (0-100)
 */
function playSound(key, volume) {
  const soundElem = document.getElementById(`sfx_${key}`);
  if (!soundElem) {
    return;
  }

  soundElem.currentTime = 0;
  soundElem.volume = volume / 100;
  soundElem.play();

  soundElem.onerror = soundElem.onended = (() => {
    return () => {
      soundElem.onerror = soundElem.onended = null;
      popQueue();
    };
  })();
}

/**
 * Text-to-speech
 */

/**
 * Add a new text-to-speech message to the queue.
 *
 * @param {string} message The message to speak
 */
function addTts(message) {
  queue.push(() => playTts(message));

  console.log('tts', message);

  if (queue.length === 1) {
    runQueue();
  }
}

/**
 * Play a text-to-speech message from the queue.
 *
 * @param {message} message The message to speak
 */
function playTts(message) {
  if (!config.tts) {
    return;
  }

  const tts = new Audio('/tts?message=' + encodeURIComponent(message));
  tts.volume = config.tts.volume / 100;
  tts.play();

  tts.onerror = tts.onended = (() => {
    return () => {
      tts.onerror = tts.onended = null;
      popQueue();
    };
  })();
}

/**
 * Add a chat message to the chat log.
 *
 * @param {string} username The name of the user who sent the message
 * @param {string} color The color of the username
 * @param {string} message The chat message
 */
function addChatMessage(username, color, message) {
  if (!config.chat) {
    return;
  }

  const chatBox = document.getElementById('chat');
  if (!chatBox) {
    return;
  }

  const newElem = document.createElement('div');

  const nameElem = document.createElement('span');
  nameElem.className = 'chatname';
  nameElem.style = 'color: ' + color + ';';
  nameElem.innerText = username + ': ';

  const messageElem = document.createElement('span');
  messageElem.innerHTML = message;

  newElem.appendChild(nameElem);
  newElem.appendChild(messageElem);
  chatBox.appendChild(newElem);
}

/**
 * Update the trivia text.
 *
 * @param {string} text The new text
 */
function updateTrivia(text) {
  if (!config.trivia) {
    return;
  }

  const triviaBox = document.getElementById('trivia');
  if (!triviaBox) {
    return;
  }

  triviaBox.style.opacity = 0;
  setTimeout(() => {
    triviaBox.innerText = text;
    triviaBox.style.opacity = 1;
  }, 300);
}
