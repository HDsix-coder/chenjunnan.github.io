/* ==========================================================================
   ZHANGSAN.OS — shared behaviour
   Clock · work filter · local browser tools. No dependencies, no network.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (selector, root) {
    return (root || document).querySelector(selector);
  };

  var $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  var pad2 = function (value) {
    return String(value).padStart(2, "0");
  };

  var formatNumber = function (value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  var setMessage = function (element, text, isError) {
    if (!element) return;
    element.textContent = text;
    element.classList.toggle("is-error", Boolean(isError));
  };

  var copyTextToClipboard = function (text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopyText(text);
        }
      );
    }
    return Promise.resolve(legacyCopyText(text));
  };

  var legacyCopyText = function (text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();

    var copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }

    document.body.removeChild(area);
    return copied;
  };

  /* Clock ------------------------------------------------------------------ */
  function initClock() {
    var clocks = $$("[data-clock]");
    var years = $$("[data-year]");

    if (!clocks.length && !years.length) return;

    var tick = function () {
      var now = new Date();
      var time = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());

      clocks.forEach(function (element) {
        element.textContent = time;
      });

      years.forEach(function (element) {
        element.textContent = String(now.getFullYear());
      });
    };

    tick();
    window.setInterval(tick, 1000);
  }

  /* Work filter ------------------------------------------------------------ */
  function initWorkFilter() {
    var bar = $("[data-work-filters]");
    var grid = $("[data-work-grid]");

    if (!bar || !grid) return;

    var buttons = $$("[data-filter]", bar);
    var cards = $$("[data-cat]", grid);
    var emptyState = $("[data-work-empty]");
    var visibleOutput = $("[data-work-visible]");
    var countOutputs = $$("[data-filter-count]");

    var counts = { all: cards.length };
    cards.forEach(function (card) {
      var category = card.getAttribute("data-cat");
      if (!category) return;
      counts[category] = (counts[category] || 0) + 1;
    });

    countOutputs.forEach(function (output) {
      var category = output.getAttribute("data-filter-count");
      output.textContent = pad2(counts[category] || 0);
    });

    var applyFilter = function (filter) {
      var shown = 0;

      cards.forEach(function (card) {
        var matches = filter === "all" || card.getAttribute("data-cat") === filter;
        card.hidden = !matches;
        if (matches) shown += 1;
      });

      if (emptyState) emptyState.hidden = shown !== 0;
      if (visibleOutput) visibleOutput.textContent = pad2(shown);

      buttons.forEach(function (button) {
        var active = button.getAttribute("data-filter") === filter;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    };

    bar.addEventListener("click", function (event) {
      var button = event.target.closest("[data-filter]");
      if (!button || !bar.contains(button)) return;
      applyFilter(button.getAttribute("data-filter") || "all");
    });

    applyFilter("all");
  }

  /* Timestamp -------------------------------------------------------------- */
  function initTimestamp() {
    var form = $("#timestamp-form");
    if (!form) return;

    var input = $("#ts-input");
    var output = $("#ts-output");
    var message = $("#ts-msg");
    var nowButton = form.querySelector("[data-ts-now]");
    var zone = "LOCAL";

    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "LOCAL";
    } catch (error) {
      zone = "LOCAL";
    }

    var localStamp = function (date) {
      return (
        date.getFullYear() +
        "-" +
        pad2(date.getMonth() + 1) +
        "-" +
        pad2(date.getDate()) +
        " " +
        pad2(date.getHours()) +
        ":" +
        pad2(date.getMinutes()) +
        ":" +
        pad2(date.getSeconds())
      );
    };

    var render = function (date, source) {
      output.textContent = [
        "LOCAL   " + localStamp(date) + "  [" + zone + "]",
        "UTC     " + date.toISOString().slice(0, 19).replace("T", " ") + "  [UTC]",
        "UNIX    " + Math.floor(date.getTime() / 1000) + "  [s]",
        "UNIXMS  " + date.getTime() + "  [ms]"
      ].join("\n");
      output.classList.remove("is-error");
      setMessage(message, "OK / " + source + " / " + zone, false);
    };

    var parseTimestamp = function (raw) {
      var value = raw.trim();
      if (!value) return new Date();

      if (/^[+-]?\d+$/.test(value)) {
        var numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        var digits = value.replace(/^[+-]/, "").length;
        var millis = digits <= 10 ? numeric * 1000 : numeric;
        var numericDate = new Date(millis);
        if (Number.isNaN(numericDate.getTime())) return null;
        return numericDate;
      }

      var normalized = value.replace(
        /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)$/,
        "$1T$2"
      );
      var parsed = Date.parse(normalized);
      if (Number.isNaN(parsed)) parsed = Date.parse(value);
      if (Number.isNaN(parsed)) return null;
      return new Date(parsed);
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var date = parseTimestamp(input.value);

      if (!date) {
        output.textContent =
          "!! INVALID TIMESTAMP\n" +
          "EXPECTED  Unix seconds / milliseconds, or YYYY-MM-DD HH:mm";
        output.classList.add("is-error");
        setMessage(message, "ERROR / CHECK INPUT", true);
        return;
      }

      render(date, input.value.trim() ? "INPUT" : "NOW");
    });

    if (nowButton) {
      nowButton.addEventListener("click", function () {
        var now = new Date();
        input.value = String(Math.floor(now.getTime() / 1000));
        render(now, "NOW");
      });
    }

    render(new Date(), "NOW");
  }

  /* JSON ------------------------------------------------------------------- */
  function initJson() {
    var form = $("#json-form");
    if (!form) return;

    var input = $("#json-input");
    var output = $("#json-output");
    var message = $("#json-msg");
    var clearButton = form.querySelector("[data-json-clear]");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var raw = input.value;
      var submitter = event.submitter;
      var mode =
        submitter && submitter.getAttribute("data-json-mode") === "minify"
          ? "minify"
          : "format";

      if (!raw.trim()) {
        output.textContent = "// NOTHING TO PARSE\n// PASTE JSON INTO THE FIELD ABOVE";
        output.classList.remove("is-error");
        setMessage(message, "EMPTY INPUT", false);
        return;
      }

      var parsed;

      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        output.textContent = "!! PARSE ERROR\n" + error.message;
        output.classList.add("is-error");
        setMessage(message, "ERROR / INVALID JSON", true);
        return;
      }

      var result = JSON.stringify(parsed, null, mode === "format" ? 2 : 0);
      var bytes;

      try {
        bytes = new TextEncoder().encode(result).length;
      } catch (error) {
        bytes = result.length;
      }

      output.textContent = result;
      output.classList.remove("is-error");
      setMessage(message, mode.toUpperCase() + " OK / " + formatNumber(bytes) + " BYTES", false);
    });

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        input.value = "";
        output.textContent = "// AWAITING INPUT";
        output.classList.remove("is-error");
        setMessage(message, "CLEARED / READY", false);
        input.focus();
      });
    }
  }

  /* Contrast --------------------------------------------------------------- */
  function initContrast() {
    var foreground = $("#contrast-fg");
    var background = $("#contrast-bg");

    if (!foreground || !background) return;

    var ratioOutput = $("#contrast-ratio");
    var preview = $("#contrast-preview");
    var message = $("#contrast-msg");
    var badges = $$("[data-level]", $("#contrast-badges") || document);

    var thresholds = {
      "aa-normal": 4.5,
      "aaa-normal": 7,
      "aa-large": 3,
      "aaa-large": 4.5
    };

    var hexToRgb = function (hex) {
      var clean = String(hex).replace("#", "");
      if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16)
      };
    };

    var channel = function (value) {
      var scaled = value / 255;
      return scaled <= 0.04045 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
    };

    var luminance = function (rgb) {
      return (
        0.2126 * channel(rgb.r) +
        0.7152 * channel(rgb.g) +
        0.0722 * channel(rgb.b)
      );
    };

    var update = function () {
      var fg = hexToRgb(foreground.value);
      var bg = hexToRgb(background.value);

      if (!fg || !bg || !ratioOutput) return;

      var fgLum = luminance(fg);
      var bgLum = luminance(bg);
      var ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);

      ratioOutput.textContent = ratio.toFixed(2) + ":1";

      badges.forEach(function (item) {
        var level = item.getAttribute("data-level");
        var threshold = thresholds[level] || 4.5;
        var pass = ratio >= threshold;
        item.classList.toggle("is-pass", pass);
        var value = item.querySelector("b");
        if (value) value.textContent = pass ? "PASS" : "FAIL";
      });

      if (preview) {
        preview.style.color = foreground.value;
        preview.style.backgroundColor = background.value;
      }

      setMessage(
        message,
        "LIVE / " + foreground.value.toUpperCase() + " ON " + background.value.toUpperCase(),
        false
      );
    };

    [foreground, background].forEach(function (input) {
      input.addEventListener("input", update);
    });

    update();
  }

  /* UUID ------------------------------------------------------------------- */
  function initUuid() {
    var generateButton = $("[data-uuid-generate]");
    var copyButton = $("[data-uuid-copy]");
    var output = $("#uuid-output");
    var message = $("#uuid-msg");

    if (!generateButton || !output) return;

    var cryptoApi = window.crypto || null;

    var cryptoUuid = function () {
      var bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = Array.prototype.map
        .call(bytes, function (byte) {
          return byte.toString(16).padStart(2, "0");
        })
        .join("");
      return (
        hex.slice(0, 8) +
        "-" +
        hex.slice(8, 12) +
        "-" +
        hex.slice(12, 16) +
        "-" +
        hex.slice(16, 20) +
        "-" +
        hex.slice(20)
      );
    };

    var mathUuid = function () {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (character) {
        var random = (Math.random() * 16) | 0;
        var value = character === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
    };

    var makeUuid = function () {
      if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
        return cryptoApi.randomUUID();
      }
      if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
        return cryptoUuid();
      }
      return mathUuid();
    };

    var generate = function (announce) {
      var values = [];
      for (var index = 0; index < 5; index += 1) {
        values.push(makeUuid());
      }
      output.textContent = values.join("\n");
      output.classList.remove("is-error");
      if (announce) {
        setMessage(message, "GENERATED 5 / UUID V4", false);
      }
    };

    var copyText = function (text) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        return navigator.clipboard.writeText(text).then(
          function () {
            return true;
          },
          function () {
            return legacyCopy(text);
          }
        );
      }
      return Promise.resolve(legacyCopy(text));
    };

    var legacyCopy = function (text) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();

      var copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (error) {
        copied = false;
      }

      document.body.removeChild(area);
      return copied;
    };

    var selectOutput = function () {
      if (!window.getSelection) return;
      var selection = window.getSelection();
      if (!selection) return;
      var range = document.createRange();
      range.selectNodeContents(output);
      selection.removeAllRanges();
      selection.addRange(range);
    };

    generateButton.addEventListener("click", function () {
      generate(true);
    });

    if (copyButton) {
      copyButton.addEventListener("click", function () {
        var text = output.textContent.trim();
        if (!text) {
          setMessage(message, "NOTHING TO COPY", true);
          return;
        }

        var count = text.split("\n").filter(Boolean).length;
        setMessage(message, "COPYING / " + count + " UUIDS", false);

        copyText(text).then(function (copied) {
          if (copied) {
            setMessage(message, "COPIED " + count + " / CLIPBOARD", false);
          } else {
            selectOutput();
            setMessage(message, "COPY BLOCKED / SELECTED MANUALLY", true);
          }
        });
      });
    }

    generate(false);
    setMessage(message, "UUID V4 / LOCAL CRYPTO", false);
  }

  /* Toolcase: base64, morse, caesar, base conversion ----------------------- */
  function initBase64() {
    var form = $("#base64-form");
    if (!form) return;

    var input = $("#b64-input");
    var output = $("#b64-output");
    var message = $("#b64-msg");
    var copyButton = $("[data-b64-copy]");
    var clearButton = $("[data-b64-clear]");
    if (!input || !output) return;

    var lastResult = "";

    var write = function (text, isError) {
      output.textContent = text;
      output.classList.toggle("is-error", Boolean(isError));
      lastResult = isError ? "" : text;
    };

    var bytesToBase64 = function (bytes) {
      var binary = "";
      var chunk = 0x8000;
      for (var index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
      }
      return btoa(binary);
    };

    var base64ToBytes = function (value) {
      var clean = value
        .trim()
        .replace(/\s+/g, "")
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      if (!clean) throw new Error("EMPTY BASE64");
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error("INVALID BASE64");
      if (clean.length % 4 === 1) throw new Error("INVALID BASE64 LENGTH");

      while (clean.length % 4 !== 0) clean += "=";

      var binary = atob(clean);
      var bytes = new Uint8Array(binary.length);
      for (var index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    };

    var getMode = function (submitter) {
      var value = submitter && submitter.getAttribute("data-b64-mode");
      return value === "decode" ? "decode" : "encode";
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var raw = input.value;
      var mode = getMode(event.submitter);

      if (!raw.trim()) {
        write("// AWAITING INPUT", true);
        setMessage(message, "!! INPUT REQUIRED", true);
        return;
      }

      try {
        if (mode === "encode") {
          if (!window.TextEncoder) throw new Error("TEXT ENCODER UNAVAILABLE");
          var encoded = bytesToBase64(new TextEncoder().encode(raw));
          write(encoded, false);
          setMessage(message, "ENCODED / " + new TextEncoder().encode(raw).length + " BYTES / UTF-8", false);
        } else {
          if (!window.TextDecoder) throw new Error("TEXT DECODER UNAVAILABLE");
          var bytes = base64ToBytes(raw);
          var decoded = new TextDecoder("utf-8").decode(bytes);
          write(decoded, false);
          setMessage(message, "DECODED / " + bytes.length + " BYTES / UTF-8", false);
        }
      } catch (error) {
        write("!! " + error.message, true);
        setMessage(message, "!! " + error.message, true);
      }
    });

    if (copyButton) {
      copyButton.addEventListener("click", function () {
        if (!lastResult) {
          setMessage(message, "NOTHING TO COPY", true);
          return;
        }
        copyTextToClipboard(lastResult).then(function (copied) {
          setMessage(
            message,
            copied ? "COPIED / CLIPBOARD" : "COPY BLOCKED / SELECTED MANUALLY",
            !copied
          );
        });
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        input.value = "";
        write("// AWAITING INPUT", false);
        setMessage(message, "READY / UTF-8", false);
        input.focus();
      });
    }
  }

  function initMorse() {
    var form = $("#morse-form");
    if (!form) return;

    var input = $("#morse-input");
    var output = $("#morse-output");
    var message = $("#morse-msg");
    var copyButton = $("[data-morse-copy]");
    var clearButton = $("[data-morse-clear]");
    if (!input || !output) return;

    var table = {
      A: ".-",
      B: "-...",
      C: "-.-.",
      D: "-..",
      E: ".",
      F: "..-.",
      G: "--.",
      H: "....",
      I: "..",
      J: ".---",
      K: "-.-",
      L: ".-..",
      M: "--",
      N: "-.",
      O: "---",
      P: ".--.",
      Q: "--.-",
      R: ".-.",
      S: "...",
      T: "-",
      U: "..-",
      V: "...-",
      W: ".--",
      X: "-..-",
      Y: "-.--",
      Z: "--..",
      0: "-----",
      1: ".----",
      2: "..---",
      3: "...--",
      4: "....-",
      5: ".....",
      6: "-....",
      7: "--...",
      8: "---..",
      9: "----.",
      ".": ".-.-.-",
      ",": "--..--",
      "?": "..--..",
      "'": ".----.",
      "!": "-.-.--",
      "/": "-..-.",
      "(": "-.--.",
      ")": "-.--.-",
      "&": ".-...",
      ":": "---...",
      ";": "-.-.-.",
      "=": "-...-",
      "+": ".-.-.",
      "-": "-....-",
      "_": "..--.-",
      "\"": ".-..-.",
      "$": "...-..-",
      "@": ".--.-."
    };

    var reverse = {};
    Object.keys(table).forEach(function (key) {
      reverse[table[key]] = key;
    });

    var lastResult = "";

    var write = function (text, isError) {
      output.textContent = text;
      output.classList.toggle("is-error", Boolean(isError));
      lastResult = isError ? "" : text;
    };

    var getMode = function (submitter) {
      var value = submitter && submitter.getAttribute("data-morse-mode");
      return value === "decode" ? "decode" : "encode";
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var raw = input.value;
      var mode = getMode(event.submitter);

      if (!raw.trim()) {
        write("// AWAITING INPUT", true);
        setMessage(message, "!! INPUT REQUIRED", true);
        return;
      }

      if (mode === "encode") {
        var skipped = 0;
        var words = raw
          .toUpperCase()
          .trim()
          .split(/\s+/)
          .map(function (word) {
            var symbols = [];
            word.split("").forEach(function (character) {
              if (table[character]) {
                symbols.push(table[character]);
              } else if (character) {
                skipped += 1;
              }
            });
            return symbols.join(" ");
          })
          .filter(Boolean);

        if (!words.length) {
          write("!! NO ENCODABLE CHARACTERS", true);
          setMessage(message, "!! NO ENCODABLE CHARACTERS", true);
          return;
        }

        write(words.join(" / "), false);
        setMessage(
          message,
          "ENCODED / " + words.length + " WORDS" + (skipped ? " / " + skipped + " SKIPPED" : ""),
          false
        );
      } else {
        var unknown = 0;
        var tokenCount = 0;
        var decoded = raw
          .trim()
          .split(/\s*(?:\/|\|)\s*/)
          .map(function (word) {
            if (!word.trim()) return "";
            return word
              .trim()
              .split(/\s+/)
              .map(function (token) {
                tokenCount += 1;
                if (reverse[token]) return reverse[token];
                unknown += 1;
                return "?";
              })
              .join("");
          })
          .filter(function (word) {
            return word !== "";
          });

        if (!tokenCount) {
          write("!! NO MORSE TOKENS", true);
          setMessage(message, "!! NO MORSE TOKENS", true);
          return;
        }

        write(decoded.join(" "), unknown > 0);
        setMessage(
          message,
          "DECODED / " + tokenCount + " TOKENS" + (unknown ? " / " + unknown + " UNKNOWN" : ""),
          unknown > 0
        );
      }
    });

    if (copyButton) {
      copyButton.addEventListener("click", function () {
        if (!lastResult) {
          setMessage(message, "NOTHING TO COPY", true);
          return;
        }
        copyTextToClipboard(lastResult).then(function (copied) {
          setMessage(
            message,
            copied ? "COPIED / CLIPBOARD" : "COPY BLOCKED / SELECTED MANUALLY",
            !copied
          );
        });
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        input.value = "";
        write("// AWAITING INPUT", false);
        setMessage(message, "READY / . AND -", false);
        input.focus();
      });
    }
  }

  function initCaesar() {
    var form = $("#caesar-form");
    if (!form) return;

    var input = $("#caesar-input");
    var shiftInput = $("#caesar-shift");
    var output = $("#caesar-output");
    var message = $("#caesar-msg");
    var copyButton = $("[data-caesar-copy]");
    var clearButton = $("[data-caesar-clear]");
    if (!input || !shiftInput || !output) return;

    var lastResult = "";

    var write = function (text, isError) {
      output.textContent = text;
      output.classList.toggle("is-error", Boolean(isError));
      lastResult = isError ? "" : text;
    };

    var getMode = function (submitter) {
      var value = submitter && submitter.getAttribute("data-caesar-mode");
      return value === "decode" ? "decode" : "encode";
    };

    var shiftText = function (text, shift, direction) {
      return text.replace(/[A-Za-z]/g, function (character) {
        var code = character.charCodeAt(0);
        var upper = code >= 65 && code <= 90;
        var base = upper ? 65 : 97;
        var offset = (code - base + direction * shift + 26) % 26;
        return String.fromCharCode(base + offset);
      });
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var raw = input.value;
      var shift = parseInt(shiftInput.value, 10);
      var mode = getMode(event.submitter);

      if (!raw.trim()) {
        write("// AWAITING INPUT", true);
        setMessage(message, "!! INPUT REQUIRED", true);
        return;
      }

      if (!Number.isInteger(shift) || shift < 1 || shift > 25) {
        write("!! SHIFT MUST BE 1-25", true);
        setMessage(message, "!! SHIFT MUST BE 1-25", true);
        return;
      }

      var direction = mode === "encode" ? 1 : -1;
      write(shiftText(raw, shift, direction), false);
      setMessage(
        message,
        (mode === "encode" ? "ENCODED" : "DECODED") + " / SHIFT " + shift + " / A-Z PRESERVED",
        false
      );
    });

    if (copyButton) {
      copyButton.addEventListener("click", function () {
        if (!lastResult) {
          setMessage(message, "NOTHING TO COPY", true);
          return;
        }
        copyTextToClipboard(lastResult).then(function (copied) {
          setMessage(
            message,
            copied ? "COPIED / CLIPBOARD" : "COPY BLOCKED / SELECTED MANUALLY",
            !copied
          );
        });
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        input.value = "";
        shiftInput.value = "3";
        write("// AWAITING INPUT", false);
        setMessage(message, "READY / A-Z ONLY", false);
        input.focus();
      });
    }
  }

  function initBaseConverter() {
    var form = $("#base-form");
    if (!form) return;

    var input = $("#base-input");
    var baseInput = $("#base-from");
    var output = $("#base-output");
    var message = $("#base-msg");
    var copyButton = $("[data-base-copy]");
    var clearButton = $("[data-base-clear]");
    if (!input || !baseInput || !output) return;

    var lastResult = "";
    var examples = { 2: "1010", 8: "755", 10: "255", 16: "FF" };
    var accepted = { 2: "0-1", 8: "0-7", 10: "0-9", 16: "0-9, A-F" };
    var names = { 2: "BINARY", 8: "OCTAL", 10: "DECIMAL", 16: "HEX" };

    var write = function (text, isError) {
      output.textContent = text;
      output.classList.toggle("is-error", Boolean(isError));
      lastResult = isError ? "" : text;
    };

    var syncPlaceholder = function () {
      input.placeholder = examples[baseInput.value] || "1010";
    };

    baseInput.addEventListener("change", syncPlaceholder);
    syncPlaceholder();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var raw = input.value.trim();
      var base = parseInt(baseInput.value, 10);

      if (!raw) {
        write("// AWAITING INPUT", true);
        setMessage(message, "!! INPUT REQUIRED", true);
        return;
      }

      if ([2, 8, 10, 16].indexOf(base) === -1) {
        write("!! USE BASE 2, 8, 10 OR 16", true);
        setMessage(message, "!! USE BASE 2, 8, 10 OR 16", true);
        return;
      }

      var clean = raw.replace(/[\s_,]/g, "");
      var negative = false;

      if (clean.charAt(0) === "-") {
        negative = true;
        clean = clean.slice(1);
      } else if (clean.charAt(0) === "+") {
        clean = clean.slice(1);
      }

      var prefix = clean.slice(0, 2).toLowerCase();
      if (prefix === "0b") {
        base = 2;
        clean = clean.slice(2);
      } else if (prefix === "0o") {
        base = 8;
        clean = clean.slice(2);
      } else if (prefix === "0x") {
        base = 16;
        clean = clean.slice(2);
      }

      if (baseInput.value !== String(base)) {
        baseInput.value = String(base);
        syncPlaceholder();
      }

      if (!clean) {
        write("!! INVALID NUMBER", true);
        setMessage(message, "!! INVALID NUMBER", true);
        return;
      }

      var value = BigInt(0);
      var unit = BigInt(base);

      for (var index = 0; index < clean.length; index += 1) {
        var digit = parseInt(clean.charAt(index), 36);
        if (!Number.isInteger(digit) || digit >= base) {
          var hint = "!! " + names[base] + " ACCEPTS " + accepted[base];
          write(hint, true);
          setMessage(message, hint, true);
          return;
        }
        value = value * unit + BigInt(digit);
      }

      if (negative) value = -value;

      var lines = [
        "BIN      " + value.toString(2),
        "OCT      " + value.toString(8),
        "DEC      " + value.toString(10),
        "HEX      " + value.toString(16).toUpperCase()
      ];

      write(lines.join("\n"), false);
      setMessage(message, "CONVERTED / BASE " + base + " → 2, 8, 10, 16", false);
    });

    if (copyButton) {
      copyButton.addEventListener("click", function () {
        if (!lastResult) {
          setMessage(message, "NOTHING TO COPY", true);
          return;
        }
        copyTextToClipboard(lastResult).then(function (copied) {
          setMessage(
            message,
            copied ? "COPIED / CLIPBOARD" : "COPY BLOCKED / SELECTED MANUALLY",
            !copied
          );
        });
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        input.value = "";
        baseInput.value = "10";
        syncPlaceholder();
        write("// AWAITING INPUT", false);
        setMessage(message, "BASE 2 / 8 / 10 / 16 · PREFIX 0b 0o 0x", false);
        input.focus();
      });
    }
  }

  function initMirage() {
    var root = $("[data-mirage]");
    if (!root) return;

    var inputs = $$("[data-mirage-input]", root);
    var output = $("[data-mirage-output]", root);
    var darkImage = $("[data-mirage-dark]", root);
    var lightImage = $("[data-mirage-light]", root);
    var generateButton = $("[data-mirage-generate]", root);
    var downloadLink = $("[data-mirage-download]", root);
    var clearButton = $("[data-mirage-clear]", root);
    var message = $("#mirage-msg");
    var files = { black: null, white: null };

    if (!output || !darkImage || !lightImage || !generateButton) return;

    var setStatus = function (text, isError) {
      setMessage(message, text, isError);
    };

    var resetOutput = function () {
      output.hidden = true;
      darkImage.removeAttribute("src");
      lightImage.removeAttribute("src");
      if (downloadLink) {
        downloadLink.hidden = true;
        downloadLink.removeAttribute("href");
      }
    };

    var loadImage = function (file) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var image = new Image();

        image.onload = function () {
          resolve({
            image: image,
            url: url,
            name: file.name
          });
        };
        image.onerror = function () {
          URL.revokeObjectURL(url);
          reject(new Error("IMAGE LOAD FAILED"));
        };
        image.src = url;
      });
    };

    var updateSlot = function (side) {
      var entry = files[side];
      var preview = root.querySelector('[data-mirage-preview="' + side + '"]');
      var name = root.querySelector('[data-mirage-name="' + side + '"]');
      var input = root.querySelector('[data-mirage-input][data-mirage-side="' + side + '"]');

      if (preview) {
        if (entry) {
          preview.src = entry.url;
          preview.hidden = false;
        } else {
          preview.removeAttribute("src");
          preview.hidden = true;
        }
      }

      if (name) name.textContent = entry ? entry.name : "SELECT IMAGE";
      if (input) input.value = "";
    };

    var clearSlot = function (side) {
      if (files[side] && files[side].url) {
        URL.revokeObjectURL(files[side].url);
      }
      files[side] = null;
      updateSlot(side);
    };

    var drawCover = function (context, image, width, height) {
      var sourceWidth = image.naturalWidth;
      var sourceHeight = image.naturalHeight;
      var scale = Math.max(width / sourceWidth, height / sourceHeight);
      var drawWidth = sourceWidth * scale;
      var drawHeight = sourceHeight * scale;
      context.drawImage(
        image,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
    };

    var clampChannel = function (value) {
      return Math.max(0, Math.min(255, Math.round(value)));
    };

    inputs.forEach(function (input) {
      input.addEventListener("change", function () {
        var side = input.getAttribute("data-mirage-side");
        var file = input.files && input.files[0];

        if (!side || !file) return;
        if (file.type && file.type.indexOf("image/") !== 0) {
          setStatus("!! UNSUPPORTED FILE", true);
          input.value = "";
          return;
        }

        setStatus("READING / " + side.toUpperCase() + "...", false);

        loadImage(file)
          .then(function (loaded) {
            if (files[side] && files[side].url) {
              URL.revokeObjectURL(files[side].url);
            }
            files[side] = loaded;
            updateSlot(side);
            resetOutput();
            setStatus(
              "LOADED / " + side.toUpperCase() + " / " + loaded.image.naturalWidth + "×" + loaded.image.naturalHeight,
              false
            );
          })
          .catch(function (error) {
            setStatus("!! " + error.message, true);
            input.value = "";
          });
      });
    });

    generateButton.addEventListener("click", function () {
      if (!files.black || !files.white) {
        setStatus("!! TWO IMAGES REQUIRED", true);
        return;
      }

      try {
        var base = files.white.image;
        var scale = Math.min(1, 1400 / Math.max(base.naturalWidth, base.naturalHeight));
        var width = Math.max(1, Math.round(base.naturalWidth * scale));
        var height = Math.max(1, Math.round(base.naturalHeight * scale));

        var blackCanvas = document.createElement("canvas");
        var whiteCanvas = document.createElement("canvas");
        blackCanvas.width = width;
        blackCanvas.height = height;
        whiteCanvas.width = width;
        whiteCanvas.height = height;

        var blackContext = blackCanvas.getContext("2d", { willReadFrequently: true });
        var whiteContext = whiteCanvas.getContext("2d", { willReadFrequently: true });

        blackContext.fillStyle = "#000";
        blackContext.fillRect(0, 0, width, height);
        drawCover(blackContext, files.black.image, width, height);

        whiteContext.fillStyle = "#fff";
        whiteContext.fillRect(0, 0, width, height);
        drawCover(whiteContext, files.white.image, width, height);

        var blackData = blackContext.getImageData(0, 0, width, height);
        var whiteData = whiteContext.getImageData(0, 0, width, height);
        var result = document.createElement("canvas");
        result.width = width;
        result.height = height;
        var resultContext = result.getContext("2d");
        var resultImage = resultContext.createImageData(width, height);

        for (var index = 0; index < blackData.data.length; index += 4) {
          var red = blackData.data[index];
          var green = blackData.data[index + 1];
          var blue = blackData.data[index + 2];
          var whiteRed = whiteData.data[index];
          var whiteGreen = whiteData.data[index + 1];
          var whiteBlue = whiteData.data[index + 2];

          var blackLuma = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
          var whiteLuma = (0.2126 * whiteRed + 0.7152 * whiteGreen + 0.0722 * whiteBlue) / 255;
          var alpha = 1 - (whiteLuma - blackLuma);

          if (alpha <= 0.004) {
            resultImage.data[index] = 0;
            resultImage.data[index + 1] = 0;
            resultImage.data[index + 2] = 0;
            resultImage.data[index + 3] = 0;
            continue;
          }

          alpha = Math.min(1, alpha);
          resultImage.data[index] = clampChannel(red / alpha);
          resultImage.data[index + 1] = clampChannel(green / alpha);
          resultImage.data[index + 2] = clampChannel(blue / alpha);
          resultImage.data[index + 3] = Math.round(alpha * 255);
        }

        resultContext.putImageData(resultImage, 0, 0);
        var dataUrl = result.toDataURL("image/png");

        darkImage.src = dataUrl;
        lightImage.src = dataUrl;
        output.hidden = false;

        if (downloadLink) {
          downloadLink.href = dataUrl;
          downloadLink.download = "mirage-tank-" + width + "x" + height + ".png";
          downloadLink.hidden = false;
        }

        setStatus("READY / " + width + "×" + height + " / PNG", false);

        if (typeof output.scrollIntoView === "function") {
          output.scrollIntoView({ block: "nearest" });
        }
      } catch (error) {
        resetOutput();
        setStatus("!! " + error.message, true);
      }
    });

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        clearSlot("black");
        clearSlot("white");
        resetOutput();
        setStatus("READY / TWO IMAGES REQUIRED", false);
      });
    }
  }

  /* Homepage desk pet ------------------------------------------------------ */
  function initDeskpet() {
    var pet = $("[data-deskpet]");
    if (!pet) return;

    var petButton = $("[data-pet-hit]", pet);
    var bubble = $("[data-pet-bubble]", pet);
    var heartLayer = $("[data-pet-hearts]", pet);
    if (!petButton || !bubble) return;

    var lines = [
      "页面加载完成。",
      "别只看我，去 work.html 逛逛。",
      "写代码也要记得喝水。",
      "这个站点没有 cookie。",
      "要不要看看 toolcase.html？",
      "我在右下角待命。",
      "C:\\> _"
    ];
    var patLines = [
      "唔…好舒服。",
      "再摸一下头。",
      "头发要乱了。"
    ];

    var reduceMotion = false;
    try {
      reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (error) {
      reduceMotion = false;
    }

    var bubbleTimer = 0;
    var actionTimer = 0;
    var idleTimer = 0;
    var longPressTimer = 0;
    var longPressed = false;
    var lookFrame = 0;
    var pendingPointer = null;
    var lastLine = -1;
    var dragging = false;
    var moved = false;
    var sleeping = false;
    var wasSleepingOnDown = false;
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;
    var lastActive = Date.now();
    var lastClick = 0;
    var currentAction = "";
    var actionClasses = ["is-jumping", "is-spinning", "is-dancing", "is-glitching", "is-patted", "is-purring"];

    setState("idle");

    function noteActive() {
      lastActive = Date.now();
    }

    function setState(label) {
      pet.setAttribute("data-pet-state", label);
    }

    function resetLook() {
      pet.style.setProperty("--look-x", "0px");
      pet.style.setProperty("--look-y", "0px");
      pet.style.setProperty("--look-r", "0deg");
    }

    function stopAction() {
      window.clearTimeout(actionTimer);
      for (var i = 0; i < actionClasses.length; i += 1) {
        pet.classList.remove(actionClasses[i]);
      }
      currentAction = "";
    }

    function endAction() {
      currentAction = "";
      if (!sleeping) setState("idle");
    }

    function startAction(className, duration, label) {
      if (sleeping) return;

      if (reduceMotion) {
        setState(label);
        window.clearTimeout(actionTimer);
        actionTimer = window.setTimeout(function () {
          if (!sleeping) setState("idle");
        }, 500);
        return;
      }

      stopAction();
      pet.classList.add(className);
      currentAction = className;
      setState(label);

      actionTimer = window.setTimeout(function () {
        pet.classList.remove(className);
        if (currentAction === className) endAction();
      }, duration);
    }

    function hop(label) {
      startAction("is-jumping", 620, label || "hop");
    }

    function spin(label) {
      startAction("is-spinning", 900, label || "spin");
    }

    function dance(label) {
      startAction("is-dancing", 1050, label || "dance");
    }

    function glitch(label) {
      startAction("is-glitching", 420, label || "sync");
    }

    function pat() {
      if (sleeping) return;

      noteActive();
      startAction("is-patted", 760, "pat");
      say(patLines[Math.floor(Math.random() * patLines.length)]);
      hearts(3);
    }

    function purr() {
      if (sleeping) return;

      noteActive();
      startAction("is-purring", 1100, "purr");
      say("呼噜呼噜…");
      hearts(4);
    }

    function nextLine() {
      if (!lines.length) return "";
      var index = Math.floor(Math.random() * lines.length);
      if (lines.length > 1 && index === lastLine) index = (index + 1) % lines.length;
      lastLine = index;
      return lines[index];
    }

    function positionBubble() {
      var rect = pet.getBoundingClientRect();
      bubble.classList.toggle("is-left", rect.left + rect.width / 2 < window.innerWidth / 2);
      bubble.classList.toggle("is-below", rect.top < 176);
    }

    function say(text) {
      bubble.textContent = text;
      positionBubble();
      bubble.classList.add("show");
      window.clearTimeout(bubbleTimer);
      bubbleTimer = window.setTimeout(function () {
        bubble.classList.remove("show");
      }, 2600);
    }

    function hearts(count) {
      if (!heartLayer || reduceMotion) return;

      for (var i = 0; i < count; i += 1) {
        var heart = document.createElement("i");
        heart.textContent = "♥";
        heart.style.setProperty("--x", (18 + Math.random() * 64).toFixed(1) + "%");
        heart.style.setProperty("--dx", (Math.random() * 46 - 23).toFixed(1) + "px");
        heart.style.setProperty("--rot", (Math.random() * 36 - 18).toFixed(1) + "deg");
        heart.style.setProperty("--delay", (i * 50) + "ms");
        heartLayer.appendChild(heart);

        window.setTimeout((function (node) {
          return function () {
            if (node.parentNode) node.parentNode.removeChild(node);
          };
        })(heart), 1500 + i * 50);
      }
    }

    function applyLook(event) {
      lookFrame = 0;
      var e = event || pendingPointer;
      if (!e) return;

      var rect = pet.getBoundingClientRect();
      var near = e.clientX > rect.left - 80 &&
        e.clientX < rect.right + 80 &&
        e.clientY > rect.top - 80 &&
        e.clientY < rect.bottom + 80;

      if (near) noteActive();

      if (reduceMotion || sleeping || dragging || !near) {
        resetLook();
        return;
      }

      var nx = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / 110));
      var ny = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height * 0.3)) / 120));

      pet.style.setProperty("--look-x", (nx * 3).toFixed(2) + "px");
      pet.style.setProperty("--look-y", (ny * 1.5).toFixed(2) + "px");
      pet.style.setProperty("--look-r", (nx * 2).toFixed(2) + "deg");
    }

    function onPointerMove(event) {
      pendingPointer = event;
      if (lookFrame) return;

      if (window.requestAnimationFrame) {
        lookFrame = window.requestAnimationFrame(function () {
          applyLook(pendingPointer);
        });
      } else {
        applyLook(event);
      }
    }

    function glance() {
      if (reduceMotion || sleeping) return;

      var direction = Math.random() < 0.5 ? -1 : 1;
      pet.style.setProperty("--look-x", (direction * 3).toFixed(1) + "px");
      pet.style.setProperty("--look-y", "0px");
      pet.style.setProperty("--look-r", (direction * 2.2).toFixed(1) + "deg");
      setState("scan");

      window.setTimeout(function () {
        if (!dragging) resetLook();
        if (!sleeping && !currentAction) setState("idle");
      }, 700);
    }

    function sleep() {
      if (sleeping || dragging) return;

      sleeping = true;
      stopAction();
      pet.classList.add("is-sleeping");
      resetLook();
      setState("sleep");
      say("Zzz... 小鲸睡着了。");
    }

    function wake(speak) {
      if (!sleeping) return false;

      sleeping = false;
      pet.classList.remove("is-sleeping");
      setState("wake");
      hop("wake");

      if (speak) say("唔…醒了。");
      return true;
    }

    function keepInView() {
      var width = pet.offsetWidth;
      var height = pet.offsetHeight;
      var left = parseFloat(pet.style.left);
      var top = parseFloat(pet.style.top);
      var pad = 8;

      if (!isFinite(left) || !isFinite(top)) return;

      var maxLeft = Math.max(pad, window.innerWidth - width - pad);
      var maxTop = Math.max(pad, window.innerHeight - height - pad);

      pet.style.left = Math.min(Math.max(pad, left), maxLeft) + "px";
      pet.style.top = Math.min(Math.max(pad, top), maxTop) + "px";
    }

    function detachFromCorner() {
      if (pet.style.left) return;

      var rect = pet.getBoundingClientRect();
      pet.style.right = "auto";
      pet.style.bottom = "auto";
      pet.style.left = rect.left + "px";
      pet.style.top = rect.top + "px";
    }

    function isHeadPoint(clientY) {
      var visual = $(".deskpet-visual", pet);
      if (!visual || !isFinite(clientY)) return false;

      var rect = visual.getBoundingClientRect();
      return clientY <= rect.top + rect.height * 0.43;
    }

    function endDrag(pointerId, speak, pointerY) {
      if (!dragging) {
        window.clearTimeout(longPressTimer);
        return;
      }

      window.clearTimeout(longPressTimer);
      var wasLongPress = longPressed;
      longPressed = false;

      dragging = false;
      pet.classList.remove("is-dragging");
      keepInView();
      positionBubble();

      try {
        if (pointerId !== undefined && petButton.hasPointerCapture(pointerId)) {
          petButton.releasePointerCapture(pointerId);
        }
      } catch (error) {
        /* pointer capture is optional */
      }

      var wasSleeping = wasSleepingOnDown;
      wasSleepingOnDown = false;

      if (wasLongPress) {
        lastClick = 0;
        return;
      }

      if (moved) {
        lastClick = 0;
        window.clearTimeout(bubbleTimer);
        bubble.classList.remove("show");
        if (!sleeping) setState("idle");
        return;
      }

      if (!speak) {
        if (!sleeping) setState("idle");
        return;
      }

      if (wasSleeping) {
        say("唔…醒了。");
        hop("wake");
        hearts(3);
        return;
      }

      var now = Date.now();
      var isDouble = lastClick && now - lastClick < 380;
      lastClick = isDouble ? 0 : now;

      if (isDouble) {
        dance("dance");
        say("转一圈！");
        hearts(6);
        return;
      }

      if (isHeadPoint(pointerY)) {
        pat();
        return;
      }

      if (Math.random() < 0.28) {
        spin("spin");
        say("视线校准中。");
      } else {
        hop("hop");
        say(nextLine());
      }

      hearts(3);
    }

    petButton.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 && event.button !== undefined) return;

      noteActive();
      pet.dispatchEvent(new CustomEvent("deskpet-dragstart"));
      wasSleepingOnDown = sleeping;
      longPressed = false;
      window.clearTimeout(longPressTimer);

      if (sleeping) {
        sleeping = false;
        pet.classList.remove("is-sleeping");
      }

      stopAction();
      detachFromCorner();

      var rect = pet.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      pet.classList.add("is-dragging");
      resetLook();
      setState("drag");
      event.preventDefault();

      if (!wasSleepingOnDown) {
        longPressTimer = window.setTimeout(function () {
          if (!dragging || moved || sleeping) return;
          longPressed = true;
          purr();
        }, 700);
      }

      try {
        petButton.setPointerCapture(event.pointerId);
      } catch (error) {
        /* pointer capture is optional */
      }
    });

    petButton.addEventListener("pointermove", function (event) {
      if (!dragging) return;

      noteActive();
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        moved = true;
        window.clearTimeout(longPressTimer);
        window.clearTimeout(bubbleTimer);
        bubble.classList.remove("show");
      }

      var width = pet.offsetWidth;
      var height = pet.offsetHeight;
      var pad = 8;
      var maxLeft = Math.max(pad, window.innerWidth - width - pad);
      var maxTop = Math.max(pad, window.innerHeight - height - pad);

      pet.style.left = Math.min(Math.max(pad, startLeft + dx), maxLeft) + "px";
      pet.style.top = Math.min(Math.max(pad, startTop + dy), maxTop) + "px";
      event.preventDefault();
    });

    petButton.addEventListener("pointerup", function (event) {
      endDrag(event.pointerId, true, event.clientY);
    });

    petButton.addEventListener("pointercancel", function () {
      endDrag(undefined, false);
    });

    petButton.addEventListener("pointerenter", function () {
      noteActive();
    });

    petButton.addEventListener("pointerleave", function () {
      resetLook();
    });

    petButton.addEventListener("focus", function () {
      noteActive();
    });

    petButton.addEventListener("keydown", function (event) {
      noteActive();

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();

        if (sleeping) {
          wake(true);
          hearts(2);
          return;
        }

        hop("hop");
        say(nextLine());
        hearts(2);
        return;
      }

      if (event.key === "s" || event.key === "S") {
        event.preventDefault();

        if (sleeping) {
          wake(true);
        } else {
          sleep();
        }
        return;
      }

      if (event.key === "d" || event.key === "D") {
        event.preventDefault();

        if (sleeping) {
          wake(true);
          return;
        }

        dance("dance");
        say("转个圈。");
        hearts(4);
        return;
      }

      if (event.key === "g" || event.key === "G") {
        event.preventDefault();

        if (sleeping) {
          wake(true);
          return;
        }

        glitch("sync");
        say("信号抖动。");
        hearts(1);
        return;
      }

      if (event.key === "p" || event.key === "P") {
        event.preventDefault();

        if (sleeping) {
          wake(true);
          hearts(2);
          return;
        }

        pat();
        return;
      }

      if (event.key.indexOf("Arrow") !== 0) return;

      event.preventDefault();

      if (sleeping) {
        sleeping = false;
        pet.classList.remove("is-sleeping");
        setState("idle");
      }

      detachFromCorner();

      var step = event.shiftKey ? 32 : 12;
      var left = parseFloat(pet.style.left);
      var top = parseFloat(pet.style.top);

      if (event.key === "ArrowLeft") left -= step;
      if (event.key === "ArrowRight") left += step;
      if (event.key === "ArrowUp") top -= step;
      if (event.key === "ArrowDown") top += step;

      pet.style.left = left + "px";
      pet.style.top = top + "px";
      keepInView();
      positionBubble();
    });

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    window.addEventListener("resize", function () {
      keepInView();
      positionBubble();
    });

    window.setTimeout(function () {
      say("你好呀，我是小鲸。点我说话，双击转圈。");
    }, 1200);

    function randomIdle() {
      if (reduceMotion || sleeping || dragging || document.hidden || currentAction) return;

      var roll = Math.random();
      if (roll < 0.34) {
        glance();
      } else if (roll < 0.68) {
        hop("hop");
      } else if (roll < 0.82) {
        glitch("sync");
      } else if (roll < 0.94) {
        spin("spin");
      } else {
        dance("dance");
      }
    }

    function scheduleIdle() {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(function () {
        randomIdle();
        scheduleIdle();
      }, 8000 + Math.random() * 6000);
    }

    scheduleIdle();

    window.setInterval(function () {
      if (!sleeping && !dragging && !document.hidden && Date.now() - lastActive > 45000) {
        sleep();
      }
    }, 6000);
  }

  /* Homepage code rain ---------------------------------------------------- */
  function initCodeRain() {
    var canvas = $("[data-code-rain]");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.hidden = true;
      return;
    }

    var glyphs = "01{}[]()<>/\\|=+-*;:_,.$#@%&abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    var fontFamily = '"Cascadia Mono", "Cascadia Code", Consolas, monospace';
    var media = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    var reduceMotion = media ? media.matches : false;
    var width = 0;
    var height = 0;
    var columns = [];
    var raf = 0;
    var running = false;
    var lastFrame = 0;

    function resetColumn(column) {
      column.y = -Math.random() * height * 0.85 - column.size * 4;
    }

    function setup() {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textBaseline = "top";

      var size = width <= 560 ? 9 : width <= 980 ? 10 : 11;
      var cell = size * 1.25;
      var count = Math.max(30, Math.ceil(width / cell) + 1);
      columns = [];

      for (var i = 0; i < count; i += 1) {
        columns.push({
          x: i * cell + Math.random() * cell * 0.55,
          y: Math.random() * height - height * 0.25,
          size: size * (0.9 + Math.random() * 0.35),
          speed: 1.15 + Math.random() * 2.2,
          trail: 7 + Math.floor(Math.random() * 12),
          alpha: 0.085 + Math.random() * 0.21,
          seed: Math.floor(Math.random() * 1000)
        });
      }
    }

    function draw(now) {
      ctx.clearRect(0, 0, width, height);

      for (var i = 0; i < columns.length; i += 1) {
        var column = columns[i];
        column.y += column.speed;

        if (column.y - column.trail * column.size * 1.7 > height) {
          resetColumn(column);
        }

        ctx.font = "400 " + column.size.toFixed(1) + "px " + fontFamily;

        for (var depth = 0; depth < column.trail; depth += 1) {
          var y = column.y - depth * column.size * 1.7;
          if (y < -column.size || y > height) continue;

          var alpha = column.alpha * Math.pow(1 - depth / column.trail, 1.55);
          if (depth === 0) alpha = Math.min(0.95, column.alpha * 3.6);
          if (alpha < 0.018) continue;

          var glyphIndex = Math.abs(
            Math.floor((y + column.seed * 37) / (column.size * 1.7)) +
              Math.floor((now + column.seed * 91) / 620) +
              i
          ) % glyphs.length;

          ctx.fillStyle = "rgba(51, 255, 102, " + alpha.toFixed(3) + ")";
          ctx.fillText(glyphs[glyphIndex], column.x, y);
        }
      }
    }

    function loop(now) {
      if (!running) return;

      if (now - lastFrame < 33) {
        raf = window.requestAnimationFrame(loop);
        return;
      }

      lastFrame = now;
      draw(now);
      raf = window.requestAnimationFrame(loop);
    }

    function start() {
      if (running || reduceMotion || document.hidden) return;
      running = true;
      lastFrame = 0;
      raf = window.requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      window.cancelAnimationFrame(raf);
      raf = 0;
    }

    function refresh() {
      stop();
      setup();

      if (reduceMotion) {
        draw(0);
      } else {
        start();
      }
    }

    window.addEventListener("resize", refresh);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stop();
      } else if (!reduceMotion) {
        start();
      }
    });

    if (media) {
      var onMotionPreference = function (event) {
        reduceMotion = event.matches;
        refresh();
      };

      if (media.addEventListener) {
        media.addEventListener("change", onMotionPreference);
      } else if (media.addListener) {
        media.addListener(onMotionPreference);
      }
    }

    refresh();
  }

  /* Homepage contact protocol --------------------------------------------- */
  function initContactFlow() {
    var trigger = $("[data-run-contact]");
    var dialog = $("[data-scan-dialog]");
    var codeMode = $("[data-code-mode]");
    if (!trigger || !dialog || !codeMode) return;

    var closeButtons = $$("[data-scan-close]", dialog);
    var enterButton = $("[data-scan-enter]", dialog);
    var progressEl = $("[data-scan-progress]", dialog);
    var progressBar = $("[data-scan-bar]", dialog);
    var statusEl = $("[data-scan-status]", dialog);
    var stageEl = $("[data-scan-stage]", dialog);
    var coordsEl = $("[data-scan-coords]", dialog);
    var scanLog = $("[data-scan-log]", dialog);
    var checks = $$("[data-scan-check]", dialog);
    var codeExits = $$("[data-code-exit]", codeMode);
    var codePane = $("[data-code-pane]", codeMode);
    var codeLineCounter = $("[data-code-ln]", codeMode);
    var codeLog = $("[data-code-log]", codeMode);
    var codeBar = $("[data-code-bar]", codeMode);
    var codePercent = $("[data-code-percent]", codeMode);
    var codeBuildState = $("[data-code-build-state]", codeMode);
    var codeClock = $("[data-code-clock]", codeMode);
    var codeShell = $(".code-shell", codeMode);
    var breach = $("[data-breach]", codeMode);
    var breachPath = $("[data-breach-path]", codeMode);
    var breachLog = $("[data-breach-log]", codeMode);
    var breachBar = $("[data-breach-bar]", codeMode);
    var breachPercent = $("[data-breach-percent]", codeMode);
    var breachStatus = $("[data-breach-status]", codeMode);
    var breachFileRows = $$(".breach-file:not(.breach-file--head)", codeMode);
    var breachExit = $("[data-breach-exit]", codeMode);
    var pageRegions = $$(".topbar, .home, .footer, .deskpet, .skip-link");

    var scanTimers = [];
    var scanTick = 0;
    var scanOpen = false;
    var activeCheck = "";
    var lastFocus = null;
    var entering = false;
    var codeActive = false;
    var keyAdvancePending = false;
    var keyAdvanceTimer = 0;
    var codeTimers = [];
    var codeRevealTick = 0;
    var codeBuildTick = 0;
    var codeClockTick = 0;
    var codeHideTimer = 0;
    var breachScheduled = false;
    var breachOpen = false;
    var breachTimers = [];
    var breachPathTick = 0;
    var breachLogTick = 0;
    var breachProgressTick = 0;
    var logIndex = 0;
    var originalTitle = document.title;

    function preferredMotion() {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (error) {
        return false;
      }
    }

    function clearTimers(list) {
      while (list.length) {
        window.clearTimeout(list.pop());
      }
    }

    function defer(list, callback, delay) {
      var id = window.setTimeout(callback, delay);
      list.push(id);
      return id;
    }

    function addScanLog(text, ok) {
      if (!scanLog) return;

      var item = document.createElement("li");
      var stamp = document.createElement("span");
      var message = document.createElement("span");

      stamp.textContent = "00:00:" + pad2(logIndex);
      message.textContent = text;
      item.appendChild(stamp);
      item.appendChild(message);

      if (ok) item.className = "is-ok";
      scanLog.appendChild(item);
      scanLog.scrollTop = scanLog.scrollHeight;
      logIndex += 1;
    }

    function setScanCheck(key, state) {
      for (var i = 0; i < checks.length; i += 1) {
        var item = checks[i];
        if (item.getAttribute("data-scan-check") !== key) continue;

        item.classList.remove("is-active", "is-done");
        if (state) item.classList.add("is-" + state);

        var mark = $(".scan-mark", item);
        if (mark) {
          mark.textContent = state === "done" ? "[ OK ]" : state === "active" ? "[ >> ]" : "[ -- ]";
        }
        return;
      }
    }

    function setScanProgress(value, status, stage) {
      var safeValue = Math.max(0, Math.min(100, Math.round(value)));
      if (progressEl) progressEl.textContent = pad2(safeValue) + "%";
      if (progressBar) progressBar.style.width = safeValue + "%";
      if (statusEl && status) statusEl.textContent = status;
      if (stageEl && stage) stageEl.textContent = stage;
    }

    function resetScan() {
      clearTimers(scanTimers);
      if (scanTick) {
        window.clearInterval(scanTick);
        scanTick = 0;
      }
      if (keyAdvanceTimer) {
        window.clearTimeout(keyAdvanceTimer);
        keyAdvanceTimer = 0;
      }

      scanOpen = false;
      keyAdvancePending = false;
      activeCheck = "";
      logIndex = 0;

      if (enterButton) enterButton.disabled = true;
      dialog.classList.remove("is-granted");
      setScanProgress(0, "INITIALIZING", "STANDBY");
      if (coordsEl) coordsEl.textContent = "X 000.000 / Y 000.000";
      if (scanLog) scanLog.textContent = "";

      for (var i = 0; i < checks.length; i += 1) {
        setScanCheck(checks[i].getAttribute("data-scan-check"), "");
      }

      addScanLog("handshake initialized / simulated");
    }

    function startCoords() {
      if (!coordsEl) return;

      var reduce = preferredMotion();
      scanTick = window.setInterval(function () {
        var x = 218 + Math.random() * 6;
        var y = 214 + Math.random() * 8;
        coordsEl.textContent = "X " + x.toFixed(3) + " / Y " + y.toFixed(3);
      }, reduce ? 520 : 130);
    }

    function scheduleScanSequence() {
      var reduce = preferredMotion();
      var scale = reduce ? 0.35 : 1;
      var steps = [
        { at: 300, value: 8, status: "SUBJECT ACQUIRED", stage: "ACQUIRED", check: "acquire", log: "signal acquired / synthetic subject" },
        { at: 930, value: 26, status: "LIVENESS CHECK", stage: "LIVENESS", check: "liveness", log: "liveness token accepted / local" },
        { at: 1630, value: 48, status: "MESH LOCK", stage: "MAPPING", check: "mesh", log: "68 points locked / no camera" },
        { at: 2330, value: 68, status: "ENTROPY SAMPLE", stage: "VERIFYING", check: "entropy", log: "entropy pool 256 bits / local" },
        { at: 3030, value: 86, status: "MATCH FOUND", stage: "MATCHED", check: "match", log: "confidence 99.97% / synthetic" },
        { at: 3730, value: 100, status: "ACCESS GRANTED", stage: "GRANTED", check: "match", log: "contact channel open / welcome, zhang", final: true }
      ];

      for (var i = 0; i < steps.length; i += 1) {
        (function (step) {
          defer(scanTimers, function () {
            if (!scanOpen) return;

            if (activeCheck) setScanCheck(activeCheck, "done");
            if (step.check) {
              activeCheck = step.check;
              setScanCheck(step.check, "active");
            }

            setScanProgress(step.value, step.status, step.stage);
            addScanLog(step.log, Boolean(step.final));

            if (step.final) {
              for (var j = 0; j < checks.length; j += 1) {
                setScanCheck(checks[j].getAttribute("data-scan-check"), "done");
              }
              activeCheck = "";
              dialog.classList.add("is-granted");
              if (enterButton) enterButton.disabled = false;

              defer(scanTimers, function () {
                if (scanOpen && !entering) enterCodeMode();
              }, 1100 * scale);
            }
          }, step.at * scale);
        })(steps[i]);
      }
    }

    function openScan(event) {
      if (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
      }

      if (scanOpen || codeActive || entering) return;

      lastFocus = trigger;
      resetScan();

      try {
        if (!dialog.open) dialog.showModal();
      } catch (error) {
        return;
      }

      scanOpen = true;
      document.body.classList.add("is-scanning");
      document.body.style.overflow = "hidden";
      dialog.classList.add("is-active");
      startCoords();
      scheduleScanSequence();

      window.setTimeout(function () {
        if (dialog.focus) {
          dialog.focus();
        } else if (closeButtons[0]) {
          closeButtons[0].focus();
        }
      }, 40);
    }

    function closeScan(restoreFocus) {
      if (!scanOpen && !dialog.open) return;

      clearTimers(scanTimers);
      if (scanTick) {
        window.clearInterval(scanTick);
        scanTick = 0;
      }
      if (keyAdvanceTimer) {
        window.clearTimeout(keyAdvanceTimer);
        keyAdvanceTimer = 0;
      }

      scanOpen = false;
      keyAdvancePending = false;
      activeCheck = "";
      dialog.classList.remove("is-active", "is-granted");
      if (enterButton) enterButton.disabled = true;

      if (dialog.open) {
        try {
          dialog.close();
        } catch (error) {
          /* no-op */
        }
      }

      document.body.classList.remove("is-scanning");
      if (!codeActive) document.body.style.overflow = "";

      if (restoreFocus && lastFocus && lastFocus.focus) {
        window.setTimeout(function () {
          lastFocus.focus();
        }, 30);
      }
    }

    function advanceScanFromKeyboard(event) {
      if (!scanOpen || entering || codeActive || keyAdvancePending) return;
      if (event.defaultPrevented || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape" || event.key === "Tab" || event.repeat) return;

      var ignoredKeys = ["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock", "Fn", "OS"];
      if (ignoredKeys.indexOf(event.key) !== -1) return;

      var target = event.target;
      var onControl =
        target &&
        target.closest &&
        target.closest("button, a, input, textarea, select, [contenteditable='true']");

      if (onControl && (event.key === "Enter" || event.key === " " || event.key === "Spacebar")) return;

      event.preventDefault();
      keyAdvancePending = true;

      clearTimers(scanTimers);
      if (scanTick) {
        window.clearInterval(scanTick);
        scanTick = 0;
      }

      for (var i = 0; i < checks.length; i += 1) {
        setScanCheck(checks[i].getAttribute("data-scan-check"), "done");
      }

      activeCheck = "";
      dialog.classList.add("is-granted");
      if (enterButton) enterButton.disabled = false;
      setScanProgress(100, "INPUT RECEIVED", "HANDOFF");
      addScanLog("input detected / manual handoff", true);

      keyAdvanceTimer = window.setTimeout(function () {
        keyAdvanceTimer = 0;
        if (scanOpen && !entering && !codeActive) enterCodeMode();
      }, 300);
    }

    function setPageInert(isInert) {
      for (var i = 0; i < pageRegions.length; i += 1) {
        var region = pageRegions[i];

        if (isInert) {
          if (!region.hasAttribute("data-scan-prev-aria")) {
            region.setAttribute("data-scan-prev-aria", region.getAttribute("aria-hidden") || "");
          }
          region.setAttribute("aria-hidden", "true");
          region.inert = true;
        } else {
          var previous = region.getAttribute("data-scan-prev-aria");
          if (previous) {
            region.setAttribute("aria-hidden", previous);
          } else {
            region.removeAttribute("aria-hidden");
          }
          region.removeAttribute("data-scan-prev-aria");
          region.inert = false;
        }
      }
    }

    function updateCodeClock() {
      if (!codeClock) return;
      var now = new Date();
      codeClock.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());
    }

    function setCodeProgress(value, label) {
      var safeValue = Math.max(0, Math.min(100, Math.round(value)));
      if (codeBar) codeBar.style.width = safeValue + "%";
      if (codePercent) codePercent.textContent = pad2(safeValue) + "%";
      if (label && codeBuildState) codeBuildState.textContent = label;
    }

    function addCodeLog(text, ok) {
      if (!codeLog) return;

      var item = document.createElement("li");
      var stamp = document.createElement("span");
      var message = document.createElement("span");

      stamp.textContent = pad2(logIndex) + "ms";
      message.textContent = text;
      item.appendChild(stamp);
      item.appendChild(message);
      if (ok) item.className = "is-ok";
      codeLog.appendChild(item);
      codeLog.scrollTop = codeLog.scrollHeight;
      logIndex += 1;
    }

    function resetCode() {
      clearTimers(codeTimers);
      if (codeRevealTick) {
        window.clearInterval(codeRevealTick);
        codeRevealTick = 0;
      }
      if (codeBuildTick) {
        window.clearInterval(codeBuildTick);
        codeBuildTick = 0;
      }
      if (codeClockTick) {
        window.clearInterval(codeClockTick);
        codeClockTick = 0;
      }
      if (codeHideTimer) {
        window.clearTimeout(codeHideTimer);
        codeHideTimer = 0;
      }

      logIndex = 0;

      var lines = $$("[data-code-line]", codeMode);
      for (var i = 0; i < lines.length; i += 1) {
        lines[i].classList.remove("is-visible");
      }

      if (codePane) codePane.scrollTop = 0;
      if (codeLog) codeLog.textContent = "";
      if (codeLineCounter) codeLineCounter.textContent = "01";
      if (codeBuildState) {
        codeBuildState.textContent = "QUEUED";
        codeBuildState.classList.remove("is-ok");
      }
      setCodeProgress(0);
    }

    function revealCode() {
      var lines = $$("[data-code-line]", codeMode);
      if (!lines.length) return;

      if (preferredMotion()) {
        for (var i = 0; i < lines.length; i += 1) {
          lines[i].classList.add("is-visible");
        }
        if (codeLineCounter) codeLineCounter.textContent = pad2(lines.length);
        return;
      }

      var index = 0;
      codeRevealTick = window.setInterval(function () {
        if (index >= lines.length) {
          window.clearInterval(codeRevealTick);
          codeRevealTick = 0;
          return;
        }

        lines[index].classList.add("is-visible");
        if (codeLineCounter) codeLineCounter.textContent = pad2(index + 1);
        if (codePane) codePane.scrollTop = codePane.scrollHeight;
        index += 1;

        if (index >= lines.length) {
          window.clearInterval(codeRevealTick);
          codeRevealTick = 0;
        }
      }, 75);
    }

    function finishCodeBuild() {
      setCodeProgress(100, "BUILD OK");
      if (codeBuildState) codeBuildState.classList.add("is-ok");
      addCodeLog("build complete / no files written / no network", true);
      scheduleBreach();
    }

    function startCodeBuild() {
      var logs = [
        { at: 100, text: "boot coding.session / dry run" },
        { at: 420, text: "subject = identify({ camera: false, mode: simulated })" },
        { at: 820, text: "mesh locked / 68 points" },
        { at: 1240, text: "typecheck 19 files / 0 errors" },
        { at: 1660, text: "branch coding/handshake / ready" }
      ];

      if (codeBuildState) {
        codeBuildState.textContent = "BUILDING";
        codeBuildState.classList.remove("is-ok");
      }

      if (preferredMotion()) {
        for (var i = 0; i < logs.length; i += 1) addCodeLog(logs[i].text);
        createFinalLog();
        return;
      }

      for (var j = 0; j < logs.length; j += 1) {
        (function (entry) {
          defer(codeTimers, function () {
            addCodeLog(entry.text);
          }, entry.at);
        })(logs[j]);
      }

      var progress = 0;
      codeBuildTick = window.setInterval(function () {
        progress += 5 + Math.floor(Math.random() * 8);
        setCodeProgress(progress);

        if (progress >= 100) {
          window.clearInterval(codeBuildTick);
          codeBuildTick = 0;
          finishCodeBuild();
        }
      }, 170);
    }

    function createFinalLog() {
      setCodeProgress(100, "BUILD OK");
      if (codeBuildState) codeBuildState.classList.add("is-ok");
      addCodeLog("build complete / no files written / no network", true);
      scheduleBreach();
    }

    var BREACH_PATH = "C:\\Users\\HD 6\\Documents\\";
    var BREACH_LOG = [
      "C:\\Users\\HD 6> whoami",
      "hd6\\guest",
      "C:\\Users\\HD 6> explorer.exe /select,\"C:\\Users\\HD 6\\Documents\"",
      "[ok] explorer shell target attached",
      "C:\\Users\\HD 6> tree /f /a C:\\Users\\HD 6",
      "[ok] indexed 12,408 paths / 0 writes",
      "C:\\Users\\HD 6> mirror_user_input /remote:node-07",
      "[warn] keystroke stream mirrored",
      "[warn] process 0x6f attached to explorer.exe",
      "C:\\Users\\HD 6> status",
      "[100%] session hijacked / no files modified",
      "C:\\Users\\HD 6> _"
    ].join("\n");

    function setBreachProgress(value, status) {
      var safeValue = Math.max(0, Math.min(100, Math.round(value)));
      if (breachPercent) breachPercent.textContent = pad2(safeValue) + "%";
      if (breachBar) breachBar.style.width = safeValue + "%";
      if (breachStatus && status) breachStatus.textContent = status;
    }

    function clearBreachAnimations() {
      clearTimers(breachTimers);
      if (breachPathTick) {
        window.clearInterval(breachPathTick);
        breachPathTick = 0;
      }
      if (breachLogTick) {
        window.clearInterval(breachLogTick);
        breachLogTick = 0;
      }
      if (breachProgressTick) {
        window.clearInterval(breachProgressTick);
        breachProgressTick = 0;
      }
    }

    function typeBreachPath() {
      if (!breachPath) return;
      var index = 0;
      breachPath.textContent = "";

      if (preferredMotion()) {
        breachPath.textContent = BREACH_PATH;
        return;
      }

      breachPathTick = window.setInterval(function () {
        index += 1;
        breachPath.textContent = BREACH_PATH.slice(0, index);

        if (index >= BREACH_PATH.length) {
          window.clearInterval(breachPathTick);
          breachPathTick = 0;
        }
      }, 34);
    }

    function typeBreachLog() {
      if (!breachLog) return;
      var index = 0;
      breachLog.textContent = "";

      if (preferredMotion()) {
        breachLog.textContent = BREACH_LOG;
        return;
      }

      breachLogTick = window.setInterval(function () {
        index += 1;
        breachLog.textContent = BREACH_LOG.slice(0, index);
        breachLog.scrollTop = breachLog.scrollHeight;

        if (index >= BREACH_LOG.length) {
          window.clearInterval(breachLogTick);
          breachLogTick = 0;
        }
      }, 7);
    }

    function markBreachFiles() {
      if (!breachFileRows.length) return;

      for (var i = 0; i < breachFileRows.length; i += 1) {
        (function (row, delay) {
          defer(breachTimers, function () {
            row.classList.add("is-hot");
          }, delay);
        })(breachFileRows[i], 620 + i * 180);
      }
    }

    function completeBreach() {
      if (!breachOpen) return;

      clearBreachAnimations();
      if (breachPath) breachPath.textContent = BREACH_PATH;
      if (breachLog) {
        breachLog.textContent = BREACH_LOG;
        breachLog.scrollTop = breachLog.scrollHeight;
      }
      setBreachProgress(100, "INTEGRITY UNKNOWN / TRACE LOST");
      if (breach) breach.classList.add("is-complete");
    }

    function startBreach() {
      if (!breach || breachOpen || !codeActive) return;

      breachOpen = true;
      breachScheduled = false;
      clearBreachAnimations();
      breach.hidden = false;
      breach.setAttribute("aria-hidden", "false");
      codeMode.classList.add("is-breached");
      document.title = "ZHANGSAN.OS — INTRUSION";

      if (codeShell) {
        codeShell.inert = true;
        codeShell.setAttribute("aria-hidden", "true");
      }

      if (breachPath) breachPath.textContent = "";
      if (breachLog) breachLog.textContent = "";
      for (var i = 0; i < breachFileRows.length; i += 1) {
        breachFileRows[i].classList.remove("is-hot");
      }
      breach.classList.remove("is-complete");
      setBreachProgress(2, "ANOMALOUS HANDOFF / UNVERIFIED");

      if (preferredMotion()) {
        if (breachPath) breachPath.textContent = BREACH_PATH;
        if (breachLog) breachLog.textContent = BREACH_LOG;
        setBreachProgress(100, "SIMULATION / TRACE STATIC");
        breach.classList.add("is-complete");
      } else {
        typeBreachPath();
        typeBreachLog();
        markBreachFiles();

        var progress = 4;
        breachProgressTick = window.setInterval(function () {
          progress = Math.min(94, progress + 2 + Math.floor(Math.random() * 5));
          setBreachProgress(progress, "TRACE ACTIVE / INPUT MIRRORED");
        }, 180);

        defer(breachTimers, completeBreach, 5400);
      }

      defer(breachTimers, function () {
        if (breachExit) breachExit.focus();
      }, 80);
    }

    function stopBreach() {
      if (!breach) return;

      clearBreachAnimations();
      breachScheduled = false;
      breachOpen = false;
      breach.hidden = true;
      breach.setAttribute("aria-hidden", "true");
      breach.classList.remove("is-complete");
      codeMode.classList.remove("is-breached");

      if (codeShell) {
        codeShell.inert = false;
        codeShell.removeAttribute("aria-hidden");
      }

      if (breachPath) breachPath.textContent = "";
      if (breachLog) breachLog.textContent = "";
      for (var i = 0; i < breachFileRows.length; i += 1) {
        breachFileRows[i].classList.remove("is-hot");
      }
      setBreachProgress(0, "INITIALIZING / TRACE");
      if (codeActive) document.title = "ZHANGSAN.OS — CODING SESSION";
    }

    function scheduleBreach() {
      if (!breach || breachScheduled || breachOpen || !codeActive) return;
      breachScheduled = true;
      defer(breachTimers, startBreach, preferredMotion() ? 0 : 900);
    }

    function enterCodeMode() {
      if (entering || codeActive) return;
      entering = true;
      closeScan(false);
      stopBreach();

      codeActive = true;
      codeMode.hidden = false;
      document.body.classList.add("is-code-mode");
      document.body.style.overflow = "hidden";
      document.title = "ZHANGSAN.OS — CODING SESSION";
      setPageInert(true);
      resetCode();
      setCodeProgress(0, "QUEUED");
      updateCodeClock();
      codeClockTick = window.setInterval(updateCodeClock, 1000);
      revealCode();

      window.requestAnimationFrame(function () {
        codeMode.classList.add("is-active");
      });

      window.setTimeout(function () {
        if (codeExits[0]) codeExits[0].focus();
      }, 80);

      if (preferredMotion()) {
        startCodeBuild();
      } else {
        defer(codeTimers, startCodeBuild, 950);
      }

      entering = false;
    }

    function exitCodeMode() {
      if (!codeActive) return;

      stopBreach();
      codeActive = false;
      clearTimers(codeTimers);
      if (codeRevealTick) {
        window.clearInterval(codeRevealTick);
        codeRevealTick = 0;
      }
      if (codeBuildTick) {
        window.clearInterval(codeBuildTick);
        codeBuildTick = 0;
      }
      if (codeClockTick) {
        window.clearInterval(codeClockTick);
        codeClockTick = 0;
      }

      codeMode.classList.remove("is-active");
      setPageInert(false);
      document.body.classList.remove("is-code-mode");
      document.body.style.overflow = "";
      document.title = originalTitle;

      codeHideTimer = window.setTimeout(function () {
        codeMode.hidden = true;
        codeHideTimer = 0;
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }, preferredMotion() ? 0 : 240);
    }

    trigger.addEventListener("click", openScan);

    for (var i = 0; i < closeButtons.length; i += 1) {
      closeButtons[i].addEventListener("click", function () {
        closeScan(true);
      });
    }

    if (enterButton) {
      enterButton.addEventListener("click", enterCodeMode);
    }

    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeScan(true);
    });

    dialog.addEventListener("click", function (event) {
      if (!scanOpen) return;

      var rect = dialog.getBoundingClientRect();
      var outside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;

      if (outside) closeScan(true);
    });

    for (var j = 0; j < codeExits.length; j += 1) {
      codeExits[j].addEventListener("click", exitCodeMode);
    }

    document.addEventListener("keydown", advanceScanFromKeyboard);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && codeActive) {
        event.preventDefault();
        exitCodeMode();
      }
    });
  }

  /* Pet music player ------------------------------------------------------- */
  function initPetPlayer() {
    var pet = $("[data-deskpet]");
    if (!pet) return;

    var toggle = $("[data-player-toggle]", pet);
    var panel = $("[data-pet-player]", pet);
    var closeButton = $("[data-player-close]", pet);
    if (!toggle || !panel || !closeButton) return;

    var tracks = [
      { src: "assets/music/how-to-count-one-to-ten.mp3", title: "CONCRETE FOUNDATION", meta: "HOW TO COUNT ONE TO TEN", duration: 0 },
      { src: "assets/music/nujabes-luv-sic-part-3.mp3", title: "LUV(SIC) PT.3", meta: "NUJABES", duration: 0 },
      { src: "assets/music/kammerflimmer-kollektief-lichterloh.mp3", title: "LICHTERLOH", meta: "KAMMERFLIMMER KOLLEKTIEF", duration: 0 },
      { src: "assets/music/wanqing-muddy-river.mp3", title: "泥河", meta: "万能青年旅店", duration: 0 },
      { src: "assets/music/covet-glimmer.mp3", title: "GLIMMER", meta: "COVET", duration: 0 },
      { src: "assets/music/acid-ghost-nature-poem.mp3", title: "NATURE (POEM)", meta: "ACID GHOST", duration: 0 },
      { src: "assets/music/shostakovich-waltz-2.mp3", title: "WALTZ 2", meta: "SHOSTAKOVICH", duration: 0 },
      { src: "assets/music/jizue-light.mp3", title: "LIGHT", meta: "JIZUE", duration: 0 },
      { src: "assets/music/cosmic-child-cats.mp3", title: "CATS AGAIN", meta: "COSMIC CHILD", duration: 0 },
      { src: "assets/music/corn-wave-pleasant-dreams.mp3", title: "PRIYATNYE SNY", meta: "CORN WAVE", duration: 0 },
      { src: "assets/music/kan-gao-scale-theme.mp3", title: "SCALE THEME", meta: "KAN R. GAO", duration: 0 },
      { src: "assets/music/toe-sunny-boy-rhapsody.mp3", title: "SUNNY BOY RHAPSODY", meta: "TOE", duration: 0 },
      { src: "assets/music/kanno-von.mp3", title: "VON", meta: "YOKO KANNO / ARNÓR DAN", duration: 0 }
    ];
    var STORAGE_KEY = "zhangsan.whalefm.v2";
    var audio = new Audio();
    var playButton = $("[data-player-play]", panel);
    var prevButton = $("[data-player-prev]", panel);
    var nextButton = $("[data-player-next]", panel);
    var muteButton = $("[data-player-mute]", panel);
    var seek = $("[data-player-seek]", panel);
    var volumeInput = $("[data-player-volume]", panel);
    var volumeValue = $("[data-player-vol-value]", panel);
    var list = $("[data-player-list]", panel);
    var uploadButton = $("[data-player-upload]", panel);
    var uploadInput = $("[data-player-file]", panel);
    var note = $("[data-player-note]", panel);
    var title = $("[data-player-title]", panel);
    var sub = $("[data-player-sub]", panel);
    var indexText = $("[data-player-index]", panel);
    var timeText = $("[data-player-time]", panel);
    var durationText = $("[data-player-duration]", panel);
    var statusText = $("[data-player-status]", panel);
    var state = readState();
    var current = clampIndex(state.index);
    var volume = clampVolume(state.volume);
    var muted = !!state.muted;
    var panelOpen = false;
    var lastSaved = 0;
    var pendingTime = Number(state.time);
    var pendingResume = !!state.wasPlaying;

    if (!isFinite(pendingTime) || pendingTime < 0) pendingTime = 0;

    audio.preload = "metadata";
    audio.volume = volume;
    audio.muted = muted;

    function clampIndex(value) {
      var parsed = Number(value);
      if (!isFinite(parsed) || parsed < 0) return 0;
      return Math.floor(parsed) % tracks.length;
    }

    function clampVolume(value) {
      var parsed = Number(value);
      if (!isFinite(parsed)) return 0.35;
      return Math.min(1, Math.max(0, parsed));
    }

    function readState() {
      var raw = null;

      try {
        raw = window.localStorage.getItem(STORAGE_KEY);
      } catch (error) {
        raw = null;
      }

      if (!raw) {
        try {
          if (window.name && window.name.indexOf("WHALEFM:") === 0) {
            raw = window.name.slice(8);
          }
        } catch (error) {
          raw = null;
        }
      }

      if (!raw) return {};

      try {
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (error) {
        return {};
      }
    }

    function persist() {
      var activeTrack = tracks[current] || tracks[0];
      var localFile = !!(activeTrack && activeTrack.uploaded);
      var snapshot = {
        index: localFile ? 0 : current,
        time: localFile ? 0 : (isFinite(audio.currentTime) ? audio.currentTime : 0),
        volume: volume,
        muted: muted,
        wasPlaying: localFile ? false : (!audio.paused && !audio.ended)
      };
      var serialized = JSON.stringify(snapshot);

      try {
        window.localStorage.setItem(STORAGE_KEY, serialized);
      } catch (error) {
        /* Storage can be unavailable under file:// privacy settings. */
      }

      try {
        window.name = "WHALEFM:" + serialized;
      } catch (error) {
        /* window.name is a best-effort fallback for opaque file origins. */
      }
    }

    function scheduleSave() {
      var now = Date.now();
      if (now - lastSaved < 1400) return;
      lastSaved = now;
      persist();
    }

    function formatTime(value) {
      if (!isFinite(value) || value < 0) return "00:00";
      var total = Math.floor(value);
      var minutes = Math.floor(total / 60);
      var seconds = total % 60;
      return (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }

    function paddedIndex(value) {
      return value < 9 ? "0" + (value + 1) : String(value + 1);
    }

    function isAudioFile(file) {
      var type = String(file && file.type || "");
      var name = String(file && file.name || "");
      return /^audio\//i.test(type) || /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(name);
    }

    function formatFileSize(bytes) {
      if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
      if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
      return Math.max(0, bytes || 0) + " B";
    }

    function updatePlaylistNote() {
      if (note) note.textContent = "LOCAL AUDIO / " + tracks.length + " TRACKS / NO STREAM";
    }

    function addLocalFiles(files) {
      if (!files || !files.length) return;

      var startIndex = tracks.length;
      var added = 0;

      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        if (!isAudioFile(file)) continue;

        var objectUrl = URL.createObjectURL(file);
        var label = String(file.name || "LOCAL FILE").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
        if (!label) label = "LOCAL FILE";
        if (label.length > 42) label = label.slice(0, 39) + "...";

        tracks.push({
          src: objectUrl,
          title: label.toUpperCase(),
          meta: "LOCAL FILE / " + formatFileSize(file.size),
          duration: 0,
          uploaded: true
        });
        added += 1;
      }

      if (!added) {
        statusText.textContent = "NO AUDIO";
        return;
      }

      buildPlaylist();
      updatePlaylistNote();
      setTrack(startIndex, { play: true });
      list.scrollTop = list.scrollHeight;
    }

    function updateVolumeUI() {
      var percent = Math.round(volume * 100);
      volumeInput.value = String(percent);
      volumeValue.textContent = String(percent);
      volumeInput.style.setProperty("--pct", percent + "%");
      muteButton.setAttribute("aria-pressed", muted ? "true" : "false");
      muteButton.textContent = muted ? "MUTE" : "VOL";
      muteButton.setAttribute("aria-label", muted ? "取消静音" : "静音");
    }

    function updateProgress() {
      var duration = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : tracks[current].duration;
      var elapsed = isFinite(audio.currentTime) ? Math.min(audio.currentTime, duration) : 0;
      var percent = duration > 0 ? (elapsed / duration) * 1000 : 0;

      timeText.textContent = formatTime(elapsed);
      durationText.textContent = formatTime(duration);
      seek.value = String(Math.round(percent));
      seek.style.setProperty("--pct", (percent / 10).toFixed(1) + "%");
    }

    function updateTrackUI() {
      var track = tracks[current];
      title.textContent = track.title;
      sub.textContent = track.meta;
      indexText.textContent = paddedIndex(current);
      durationText.textContent = formatTime(track.duration);

      var rows = $$(".pet-track", list);
      for (var i = 0; i < rows.length; i += 1) {
        rows[i].classList.toggle("is-active", i === current);
        if (i === current) {
          rows[i].setAttribute("aria-current", "true");
        } else {
          rows[i].removeAttribute("aria-current");
        }
      }

      if ("mediaSession" in navigator && "MediaMetadata" in window) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: "WHALE_FM",
            album: "ZHANGSAN.OS / LOCAL SIGNAL"
          });
        } catch (error) {
          /* Media Session is optional. */
        }
      }
    }

    function syncPlayUI() {
      var playing = !audio.paused && !audio.ended;
      panel.classList.toggle("is-playing", playing);
      toggle.classList.toggle("is-playing", playing);
      pet.classList.toggle("is-grooving", playing);
      playButton.textContent = playing ? "II" : "\u25b6";
      playButton.setAttribute("aria-label", playing ? "暂停" : "播放");
      statusText.textContent = playing ? "PLAYING" : (audio.currentTime > 0 ? "PAUSED" : "READY");

      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.playbackState = playing ? "playing" : "paused";
        } catch (error) {
          /* Media Session is optional. */
        }
      }
    }

    function tryPlay() {
      var promise;
      try {
        promise = audio.play();
      } catch (error) {
        syncPlayUI();
        return;
      }
      if (promise && typeof promise.catch === "function") {
        promise.catch(function () {
          syncPlayUI();
        });
      }
    }

    function setTrack(index, options) {
      options = options || {};
      current = clampIndex(index);
      var seekTime = Number(options.time);
      var autoplay = !!options.play;
      var resume = !!options.resume;

      if (!isFinite(seekTime) || seekTime < 0) seekTime = 0;

      updateTrackUI();

      function onMetadata() {
        audio.removeEventListener("loadedmetadata", onMetadata);
        if (seekTime > 0) {
          var maxTime = isFinite(audio.duration) && audio.duration > 0 ? Math.max(0, audio.duration - 0.15) : seekTime;
          try {
            audio.currentTime = Math.min(seekTime, maxTime);
          } catch (error) {
            /* Some browsers disallow seeking before the media is ready. */
          }
        }
        updateProgress();
        persist();
        syncPlayUI();
        if (autoplay || resume) tryPlay();
      }

      audio.addEventListener("loadedmetadata", onMetadata);
      audio.src = tracks[current].src;
      audio.load();
      updateProgress();
    }

    function nextTrack(autoplay) {
      setTrack(current + 1, { play: autoplay !== false });
    }

    function previousTrack() {
      if (audio.currentTime > 3) {
        audio.currentTime = 0;
        updateProgress();
        persist();
        return;
      }
      setTrack(current - 1, { play: true });
    }

    function togglePlay() {
      if (audio.paused) {
        tryPlay();
      } else {
        audio.pause();
      }
    }

    function buildPlaylist() {
      list.textContent = "";
      for (var i = 0; i < tracks.length; i += 1) {
        (function (index) {
          var item = document.createElement("li");
          var button = document.createElement("button");
          var number = document.createElement("span");
          var trackName = document.createElement("span");
          var meta = document.createElement("span");

          button.type = "button";
          button.className = "pet-track";
          button.setAttribute("data-player-track", String(index));
          number.className = "pet-track-index";
          number.textContent = paddedIndex(index);
          trackName.className = "pet-track-name";
          trackName.textContent = tracks[index].title;
          meta.className = "pet-track-meta";
          meta.textContent = tracks[index].meta;

          button.appendChild(number);
          button.appendChild(trackName);
          button.appendChild(meta);
          button.addEventListener("click", function () {
            setTrack(index, { play: true });
          });
          item.appendChild(button);
          list.appendChild(item);
        })(i);
      }
    }

    function openPlayer() {
      panelOpen = true;
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "关闭 WHALE_FM 歌单播放器");
      pet.classList.add("player-open");
      closeButton.focus();
    }

    function closePlayer(returnFocus) {
      if (!panelOpen) return;
      panelOpen = false;
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "打开 WHALE_FM 歌单播放器");
      pet.classList.remove("player-open");
      if (returnFocus !== false) toggle.focus();
    }

    buildPlaylist();
    updatePlaylistNote();
    updateVolumeUI();
    updateTrackUI();
    updateProgress();
    syncPlayUI();

    toggle.addEventListener("click", function () {
      if (panelOpen) {
        closePlayer(true);
      } else {
        openPlayer();
      }
    });

    closeButton.addEventListener("click", function () {
      closePlayer(true);
    });

    pet.addEventListener("deskpet-dragstart", function () {
      closePlayer(false);
    });

    document.addEventListener("pointerdown", function (event) {
      if (!panelOpen) return;
      if (panel.contains(event.target) || toggle.contains(event.target)) return;
      closePlayer(false);
    }, true);

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !panelOpen) return;
      if (document.querySelector("dialog[open]")) return;
      var codeMode = $("[data-code-mode]");
      if (codeMode && !codeMode.hidden) return;
      closePlayer(true);
    });

    if (uploadButton && uploadInput) {
      uploadButton.addEventListener("click", function () {
        uploadInput.click();
      });
      uploadInput.addEventListener("change", function () {
        addLocalFiles(uploadInput.files);
        uploadInput.value = "";
      });
    }

    playButton.addEventListener("click", togglePlay);
    prevButton.addEventListener("click", previousTrack);
    nextButton.addEventListener("click", function () {
      nextTrack(true);
    });
    muteButton.addEventListener("click", function () {
      muted = !muted;
      audio.muted = muted;
      updateVolumeUI();
      persist();
    });

    seek.addEventListener("input", function () {
      var duration = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : tracks[current].duration;
      var target = (Number(seek.value) / 1000) * duration;
      if (isFinite(target)) {
        try {
          audio.currentTime = target;
        } catch (error) {
          /* Ignore an early seek. */
        }
        updateProgress();
        persist();
      }
    });

    volumeInput.addEventListener("input", function () {
      volume = clampVolume(Number(volumeInput.value) / 100);
      muted = false;
      audio.muted = false;
      audio.volume = volume;
      updateVolumeUI();
      persist();
    });

    audio.addEventListener("loadedmetadata", function () {
      updateProgress();
      syncPlayUI();
    });
    audio.addEventListener("timeupdate", function () {
      updateProgress();
      scheduleSave();
    });
    audio.addEventListener("play", function () {
      syncPlayUI();
      persist();
    });
    audio.addEventListener("pause", function () {
      syncPlayUI();
      persist();
    });
    audio.addEventListener("ended", function () {
      nextTrack(true);
    });
    audio.addEventListener("error", function () {
      if (statusText) statusText.textContent = "AUDIO ERR";
    });

    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.setActionHandler("play", tryPlay);
        navigator.mediaSession.setActionHandler("pause", function () {
          audio.pause();
        });
        navigator.mediaSession.setActionHandler("previoustrack", previousTrack);
        navigator.mediaSession.setActionHandler("nexttrack", function () {
          nextTrack(true);
        });
      } catch (error) {
        /* Media Session is optional. */
      }
    }

    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);

    setTrack(current, { time: pendingTime, resume: pendingResume });
  }

  /* Atlas ------------------------------------------------------------------ */
  function initAtlas() {
    var stage = $("[data-atlas]");
    if (!stage) return;

    var canvas = $("[data-atlas-canvas]", stage);
    var data = window.ATLAS_DATA;
    if (!canvas || !data || !data.nodes || !data.mask) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var hoverText = $("[data-atlas-hover]", stage);
    var coordsText = $("[data-atlas-coords]", stage);
    var statusText = $("[data-atlas-status]", stage.closest(".atlas-feature") || stage);
    var clockText = $("[data-atlas-clock]", stage.closest(".atlas-feature") || stage);
    var cursorEl = $("[data-atlas-cursor]", stage);
    var list = $("[data-atlas-list]");
    var indexText = $("[data-atlas-index]");
    var codeText = $("[data-atlas-code]");
    var nameText = $("[data-atlas-name]");
    var metaText = $("[data-atlas-meta]");
    var noteText = $("[data-atlas-note]");
    var latText = $("[data-atlas-lat]");
    var lonText = $("[data-atlas-lon]");

    var nodes = data.nodes.map(function (node) {
      return {
        id: node.id,
        name: node.name,
        label: node.label,
        status: node.status,
        note: node.note,
        lat: Number(node.lat),
        lon: Number(node.lon),
        x: 0,
        y: 0
      };
    });

    var routes = [
      [0, 3],
      [0, 2],
      [0, 4],
      [0, 7],
      [0, 10],
      [9, 8]
    ];

    var selected = 0;
    var hovered = -1;
    var width = 1;
    var height = 1;
    var dpr = 1;
    var map = { x: 0, y: 0, w: 1, h: 1 };
    var pointer = { x: 0, y: 0, active: false };
    var media = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var reduced = media ? media.matches : false;
    var raf = 0;
    var running = !document.hidden;
    var lastFrame = 0;
    var listButtons = [];
    var mapAspect = (data.lonMax - data.lonMin) / (data.latMax - data.latMin);

    function nodeIndex(value) {
      return pad2(value + 1);
    }

    function formatLat(value) {
      return Math.abs(value).toFixed(4) + " " + (value < 0 ? "S" : "N");
    }

    function formatLon(value) {
      return Math.abs(value).toFixed(4) + " " + (value < 0 ? "W" : "E");
    }

    function project(lat, lon) {
      return {
        x: map.x + ((lon - data.lonMin) / (data.lonMax - data.lonMin)) * map.w,
        y: map.y + ((data.latMax - lat) / (data.latMax - data.latMin)) * map.h
      };
    }

    function pointToGeo(x, y) {
      return {
        lon: data.lonMin + ((x - map.x) / map.w) * (data.lonMax - data.lonMin),
        lat: data.latMax - ((y - map.y) / map.h) * (data.latMax - data.latMin)
      };
    }

    function nodeAt(x, y) {
      var reach = width < 560 ? 28 : 24;
      var best = -1;
      var bestDistance = reach * reach;

      nodes.forEach(function (node, index) {
        var dx = node.x - x;
        var dy = node.y - y;
        var distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });

      return best;
    }

    function updateHover() {
      if (hoverText) {
        hoverText.textContent = hovered >= 0 ? "TRACE / " + nodes[hovered].name : "TRACE / IDLE";
      }
      if (statusText) {
        statusText.textContent = hovered >= 0 ? "SIGNAL / " + nodes[hovered].status : "TRACE / STABLE";
      }
    }

    function selectNode(index) {
      if (!nodes[index]) return;
      selected = index;
      var node = nodes[index];

      if (indexText) indexText.textContent = nodeIndex(index) + " / " + pad2(nodes.length);
      if (codeText) codeText.textContent = "NODE " + nodeIndex(index) + " / " + node.label;
      if (nameText) nameText.textContent = node.name;
      if (metaText) metaText.textContent = node.label + " / " + node.status;
      if (noteText) noteText.textContent = node.note;
      if (latText) latText.textContent = formatLat(node.lat);
      if (lonText) lonText.textContent = formatLon(node.lon);
      if (coordsText) coordsText.textContent = formatLat(node.lat) + " / " + formatLon(node.lon);

      listButtons.forEach(function (button, buttonIndex) {
        var active = buttonIndex === index;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });

      draw(performance.now());
    }

    function buildList() {
      if (!list) return;

      nodes.forEach(function (node, index) {
        var button = document.createElement("button");
        var number = document.createElement("span");
        var name = document.createElement("span");
        var state = document.createElement("span");

        button.type = "button";
        button.className = "atlas-node";
        button.setAttribute("data-atlas-node", String(index));
        button.setAttribute("aria-pressed", index === selected ? "true" : "false");

        number.className = "atlas-node-index";
        number.textContent = nodeIndex(index);
        name.className = "atlas-node-label";
        name.textContent = node.name;
        state.className = "atlas-node-state";
        state.textContent = node.label + " / " + node.status;

        button.appendChild(number);
        button.appendChild(name);
        button.appendChild(state);
        button.addEventListener("click", function () {
          selectNode(index);
        });
        list.appendChild(button);
        listButtons.push(button);
      });

      listButtons[0].classList.add("is-active");
    }

    function resize() {
      var rect = stage.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var horizontalPad = width < 560 ? 12 : 22;
      var verticalPad = height < 400 ? 26 : 36;
      var availableWidth = width - horizontalPad * 2;
      var availableHeight = height - verticalPad * 2;

      map.w = Math.min(availableWidth, availableHeight * mapAspect);
      map.h = map.w / mapAspect;
      map.x = (width - map.w) / 2;
      map.y = (height - map.h) / 2;

      nodes.forEach(function (node) {
        var point = project(node.lat, node.lon);
        node.x = point.x;
        node.y = point.y;
      });

      draw(performance.now());
    }

    function drawRoute(a, b, time, index) {
      var ax = nodes[a].x;
      var ay = nodes[a].y;
      var bx = nodes[b].x;
      var by = nodes[b].y;
      var active = selected === a || selected === b || hovered === a || hovered === b;
      var lift = Math.min(82, Math.abs(bx - ax) * 0.2 + 18);
      var cx = (ax + bx) / 2;
      var cy = (ay + by) / 2 - lift;

      ctx.save();
      ctx.setLineDash([2, 7]);
      ctx.lineDashOffset = -time * 0.025;
      ctx.strokeStyle = active ? "rgba(51,255,102,0.56)" : "rgba(51,255,102,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
      ctx.stroke();
      ctx.setLineDash([]);

      var t = ((time / 7000) + index * 0.17) % 1;
      var mt = 1 - t;
      var px = mt * mt * ax + 2 * mt * t * cx + t * t * bx;
      var py = mt * mt * ay + 2 * mt * t * cy + t * t * by;

      ctx.fillStyle = active ? "rgba(168,255,194,0.95)" : "rgba(51,255,102,0.62)";
      ctx.beginPath();
      ctx.arc(px, py, active ? 2 : 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function draw(now) {
      var time = isFinite(now) ? now : 0;
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.strokeStyle = "rgba(51,255,102,0.085)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 7]);

      for (var lon = -180; lon <= 180; lon += 30) {
        var gx = map.x + ((lon - data.lonMin) / (data.lonMax - data.lonMin)) * map.w;
        ctx.beginPath();
        ctx.moveTo(gx, map.y);
        ctx.lineTo(gx, map.y + map.h);
        ctx.stroke();
      }

      for (var lat = -60; lat <= 78; lat += 30) {
        var gy = map.y + ((data.latMax - lat) / (data.latMax - data.latMin)) * map.h;
        ctx.beginPath();
        ctx.moveTo(map.x, gy);
        ctx.lineTo(map.x + map.w, gy);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(51,255,102,0.26)";
      ctx.strokeRect(map.x + 0.5, map.y + 0.5, map.w - 1, map.h - 1);

      var corner = width < 560 ? 10 : 16;
      ctx.strokeStyle = "rgba(51,255,102,0.35)";
      [[map.x, map.y, 1, 1], [map.x + map.w, map.y, -1, 1], [map.x, map.y + map.h, 1, -1], [map.x + map.w, map.y + map.h, -1, -1]].forEach(function (cornerData) {
        ctx.beginPath();
        ctx.moveTo(cornerData[0] + cornerData[2] * corner, cornerData[1]);
        ctx.lineTo(cornerData[0], cornerData[1]);
        ctx.lineTo(cornerData[0], cornerData[1] + cornerData[3] * corner);
        ctx.stroke();
      });
      ctx.restore();

      var cellWidth = map.w / data.cols;
      var cellHeight = map.h / data.rows;
      var dotSize = width < 560 ? 1.2 : Math.min(2.4, width / 620);

      for (var row = 0; row < data.rows; row += 1) {
        var maskRow = data.mask[row] || "";
        for (var col = 0; col < data.cols; col += 1) {
          if (maskRow.charAt(col) !== "1") continue;
          var x = map.x + (col + 0.5) * cellWidth;
          var y = map.y + (row + 0.5) * cellHeight;
          var near = pointer.active;
          var distance = 9999;

          if (near) {
            var ddx = x - pointer.x;
            var ddy = y - pointer.y;
            distance = ddx * ddx + ddy * ddy;
            near = distance < 4200;
          }

          var hash = ((row * 37 + col * 73) % 97) / 97;
          ctx.fillStyle = near
            ? "rgba(196,255,208," + (0.82 + hash * 0.18) + ")"
            : "rgba(51,255,102," + (0.46 + hash * 0.34) + ")";
          var size = near ? dotSize + 0.75 : dotSize;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }

      ctx.save();
      ctx.strokeStyle = "rgba(51,255,102,0.06)";
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      ctx.moveTo(map.x, map.y + map.h / 2);
      ctx.lineTo(map.x + map.w, map.y + map.h / 2);
      ctx.stroke();
      ctx.restore();

      drawRoute(0, 3, time, 0);
      drawRoute(0, 2, time, 1);
      drawRoute(0, 4, time, 2);
      drawRoute(0, 7, time, 3);
      drawRoute(0, 10, time, 4);
      drawRoute(9, 8, time, 5);

      var scanY = map.y + ((time * 0.045) % map.h);
      var scanGradient = ctx.createLinearGradient(0, scanY - 18, 0, scanY + 2);
      scanGradient.addColorStop(0, "rgba(51,255,102,0)");
      scanGradient.addColorStop(0.75, "rgba(51,255,102,0.2)");
      scanGradient.addColorStop(1, "rgba(168,255,194,0.02)");
      ctx.fillStyle = scanGradient;
      ctx.fillRect(map.x, scanY - 18, map.w, 20);

      ctx.save();
      ctx.strokeStyle = "rgba(51,255,102,0.32)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(map.x, scanY);
      ctx.lineTo(map.x + map.w, scanY);
      ctx.stroke();
      ctx.restore();

      nodes.forEach(function (node, index) {
        var active = index === selected;
        var hot = index === hovered;
        var radius = active ? 4.6 : hot ? 3.6 : 2.5;
        var pulse = active || hot ? 4 + Math.sin(time / 420 + index) * 1.6 : 0;

        ctx.save();
        if (pulse > 0) {
          ctx.strokeStyle = "rgba(51,255,102," + (active ? 0.4 : 0.24) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, pulse + radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = active ? "#a8ffc2" : hot ? "#33ff66" : "rgba(51,255,102,0.66)";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = active ? "rgba(168,255,194,0.55)" : "rgba(51,255,102,0.25)";
        ctx.beginPath();
        ctx.moveTo(node.x - radius - 3, node.y);
        ctx.lineTo(node.x - radius - 1, node.y);
        ctx.moveTo(node.x + radius + 1, node.y);
        ctx.lineTo(node.x + radius + 3, node.y);
        ctx.moveTo(node.x, node.y - radius - 3);
        ctx.lineTo(node.x, node.y - radius - 1);
        ctx.moveTo(node.x, node.y + radius + 1);
        ctx.lineTo(node.x, node.y + radius + 3);
        ctx.stroke();

        if (active || hot) {
          ctx.fillStyle = active ? "#b8f7c4" : "#33ff66";
          ctx.font = '8px "IBM Plex Mono", ui-monospace, monospace';
          ctx.textBaseline = "bottom";
          var label = node.name;
          var labelX = Math.min(Math.max(node.x + 8, map.x + 2), map.x + map.w - ctx.measureText(label).width - 2);
          var labelY = Math.max(node.y - 7, map.y + 8);
          ctx.fillText(label, labelX, labelY);
        }
        ctx.restore();
      });

      if (pointer.active && width >= 560) {
        ctx.save();
        ctx.strokeStyle = "rgba(51,255,102,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pointer.x, map.y);
        ctx.lineTo(pointer.x, map.y + map.h);
        ctx.moveTo(map.x, pointer.y);
        ctx.lineTo(map.x + map.w, pointer.y);
        ctx.stroke();

        ctx.strokeStyle = "rgba(51,255,102,0.34)";
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(168,255,194,0.8)";
        ctx.fillRect(pointer.x - 1, pointer.y - 1, 2, 2);
        ctx.restore();
      }
    }

    function frame(now) {
      if (!running) return;
      if (now - lastFrame > 32) {
        draw(now);
        lastFrame = now;
      }
      raf = window.requestAnimationFrame(frame);
    }

    function startFrames() {
      if (reduced) {
        draw(performance.now());
        return;
      }
      if (!raf) raf = window.requestAnimationFrame(frame);
    }

    function stopFrames() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    }

    function startFramesAgain() {
      if (document.hidden) return;
      running = true;
      startFrames();
    }

    function updateClock() {
      if (!clockText) return;
      var now = new Date();
      clockText.textContent = "UTC " + pad2(now.getUTCHours()) + ":" + pad2(now.getUTCMinutes()) + ":" + pad2(now.getUTCSeconds());
    }

    function updatePointer(event) {
      var rect = stage.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;

      if (width >= 560 && event.pointerType !== "touch") {
        stage.classList.add("is-tracing");
        if (cursorEl) {
          cursorEl.style.transform = "translate(" + pointer.x + "px, " + pointer.y + "px)";
        }
      }

      var geo = pointToGeo(pointer.x, pointer.y);
      if (coordsText) {
        coordsText.textContent = formatLat(geo.lat) + " / " + formatLon(geo.lon);
      }

      var nextHover = nodeAt(pointer.x, pointer.y);
      if (nextHover !== hovered) {
        hovered = nextHover;
        updateHover();
      }

      if (reduced) draw(performance.now());
    }

    function clearPointer() {
      pointer.active = false;
      hovered = -1;
      stage.classList.remove("is-tracing");
      updateHover();
      if (reduced) draw(performance.now());
    }

    function hitNode(event) {
      var rect = stage.getBoundingClientRect();
      var index = nodeAt(event.clientX - rect.left, event.clientY - rect.top);
      if (index >= 0) selectNode(index);
    }

    canvas.addEventListener("pointermove", updatePointer);
    canvas.addEventListener("pointerleave", clearPointer);
    canvas.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "touch") updatePointer(event);
    });
    canvas.addEventListener("click", hitNode);

    if (list) buildList();
    selectNode(0);
    resize();

    if ("ResizeObserver" in window) {
      new ResizeObserver(function () {
        resize();
      }).observe(stage);
    } else {
      window.addEventListener("resize", resize);
    }

    updateClock();
    window.setInterval(updateClock, 1000);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopFrames();
      } else {
        startFramesAgain();
      }
    });

    if (media) {
      var handleMotion = function () {
        reduced = media.matches;
        if (reduced) {
          stopFrames();
          draw(performance.now());
        } else {
          startFramesAgain();
        }
      };
      if (media.addEventListener) media.addEventListener("change", handleMotion);
      else if (media.addListener) media.addListener(handleMotion);
    }

    document.addEventListener("spa:route", function (event) {
      var route = event.detail && event.detail.route;
      if (route === "atlas") {
        window.requestAnimationFrame(function () {
          resize();
          startFramesAgain();
        });
      } else {
        stopFrames();
      }
    });

    startFrames();
  }

  /* Blog composer ---------------------------------------------------------- */
  function initBlog() {
    var page = $("[data-blog]");
    if (!page) return;

    var list = $("[data-blog-list]", page);
    var featured = $("[data-blog-featured]", page);
    var newButton = $("[data-blog-new]", page);
    var countLabel = $("[data-blog-count]", page);
    var statusLabel = $("[data-blog-status]", page);
    var tagCloud = $("[data-blog-tags]", page);
    var tagCount = $("[data-blog-tag-count]", page);
    var archiveList = $("[data-blog-archive]", page);
    var archiveYear = $("[data-blog-archive-year]", page);
    var moreButton = $("[data-blog-more]", page);
    var editor = $("[data-blog-editor]");
    var reader = $("[data-blog-reader]");

    if (!list || !featured || !newButton || !editor || !reader) return;

    var form = $("[data-blog-form]", editor);
    var dateInput = $("[data-blog-date]", editor);
    var titleInput = $("[data-blog-title]", editor);
    var tagsInput = $("[data-blog-tags-input]", editor);
    var contentInput = $("[data-blog-content]", editor);
    var pinInput = $("[data-blog-pin-new]", editor);
    var formMessage = $("[data-blog-form-msg]", editor);
    var readerTitle = $("[data-blog-reader-title]", reader);
    var readerMeta = $("[data-blog-reader-meta]", reader);
    var readerTags = $("[data-blog-reader-tags]", reader);
    var readerContent = $("[data-blog-reader-content]", reader);
    var readerSource = $("[data-blog-reader-source]", reader);

    if (!form || !dateInput || !titleInput || !tagsInput || !contentInput || !formMessage) return;

    var STORAGE_KEY = "zhangsan.blog.v1";
    var preferredTags = [
      "CSS", "JS", "DESIGN", "TOOLING", "STATIC", "READING",
      "NOTES", "DEVLOG", "COLOR", "GIT", "PROCESS", "DETAIL"
    ];
    var statusTimer = 0;
    var usedIds = {};
    var pageSize = 6;
    var visibleOthers = pageSize;
    var deletedDefaultIds = [];
    var deletePendingId = null;
    var deleteTimer = 0;

    function cleanText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function formatDate(iso) {
      return String(iso || "").replace(/-/g, ".");
    }

    function todayISO() {
      var now = new Date();
      return now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
    }

    function readMinutes(value) {
      var text = String(value || "");
      var han = (text.match(/[\u3400-\u9fff]/g) || []).length;
      var latin = (text.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g) || []).length;
      var minutes = Math.max(1, Math.ceil(han / 400 + latin / 200));
      return pad2(minutes) + " MIN";
    }

    function makeExcerpt(value) {
      var text = cleanText(value);
      return text.length > 190 ? text.slice(0, 187) + "..." : text;
    }

    function normalizeTags(value) {
      var seen = {};
      return String(value || "")
        .split(",")
        .map(function (tag) {
          return cleanText(tag).toUpperCase();
        })
        .filter(function (tag) {
          if (!tag || seen[tag] || /^\d+\s*MIN$/.test(tag)) return false;
          seen[tag] = true;
          return true;
        });
    }

    function tagsFrom(scope) {
      return $$(".chip", scope)
        .map(function (chip) {
          return cleanText(chip.textContent).toUpperCase();
        })
        .filter(function (tag) {
          return tag && !/^\d+\s*MIN$/.test(tag);
        });
    }

    function readFromMeta(value) {
      var match = String(value || "").match(/\d+\s*MIN/i);
      return match ? match[0].replace(/\s+/g, " ").toUpperCase() : "05 MIN";
    }

    function defaultId(date) {
      var base = "default-" + date;
      var id = base;
      var suffix = 2;
      while (usedIds[id]) {
        id = base + "-" + suffix;
        suffix += 1;
      }
      usedIds[id] = true;
      return id;
    }

    function sortPosts(left, right) {
      if (left.date !== right.date) return left.date < right.date ? 1 : -1;
      return (right.createdAt || 0) - (left.createdAt || 0);
    }

    var featuredDate = $("[data-blog-featured-date]", featured);
    var featuredMeta = $("[data-blog-featured-meta]", featured);
    var featuredTitle = $("[data-blog-featured-title]", featured);
    var featuredExcerpt = $("[data-blog-featured-excerpt]", featured);
    var featuredBottom = $("[data-blog-featured-bottom]", featured);
    var featuredPost = {
      id: defaultId(featuredDate ? featuredDate.getAttribute("datetime") || "2026-11-09" : "2026-11-09"),
      date: featuredDate ? featuredDate.getAttribute("datetime") || "2026-11-09" : "2026-11-09",
      title: cleanText(featuredTitle ? featuredTitle.textContent : "Untitled"),
      excerpt: cleanText(featuredExcerpt ? featuredExcerpt.textContent : ""),
      content: cleanText(featuredExcerpt ? featuredExcerpt.textContent : ""),
      tags: featuredBottom ? tagsFrom(featuredBottom) : [],
      read: featuredMeta ? readFromMeta(featuredMeta.textContent) : "05 MIN",
      custom: false,
      createdAt: 0
    };
    var posts = [featuredPost];
    var pinnedId = featuredPost.id;

    $$(".post-row", list).forEach(function (row) {
      var rowDate = $(".post-date", row);
      var rowTitle = $(".post-title", row);
      var rowExcerpt = $(".post-excerpt", row);
      var rowTags = $(".post-tags", row);
      var rowRead = $(".post-read", row);
      var date = rowDate ? rowDate.getAttribute("datetime") || "1970-01-01" : "1970-01-01";
      var excerpt = cleanText(rowExcerpt ? rowExcerpt.textContent : "");
      posts.push({
        id: defaultId(date),
        date: date,
        title: cleanText(rowTitle ? rowTitle.textContent : "Untitled"),
        excerpt: excerpt,
        content: excerpt,
        tags: rowTags ? tagsFrom(rowTags) : [],
        read: rowRead ? cleanText(rowRead.textContent) || "05 MIN" : "05 MIN",
        custom: false,
        createdAt: 0
      });
    });

    function loadSaved() {
      var saved = null;
      try {
        saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      } catch (error) {
        saved = null;
      }
      if (!saved || typeof saved !== "object") return;

      if (Array.isArray(saved.posts)) {
        saved.posts.forEach(function (post) {
          if (!post || typeof post !== "object") return;
          if (typeof post.id !== "string" || !post.id) return;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(post.date || ""))) return;
          if (typeof post.title !== "string" || !post.title.trim()) return;
          if (typeof post.content !== "string" || !post.content.trim()) return;
          if (usedIds[post.id]) return;
          usedIds[post.id] = true;
          var content = String(post.content);
          posts.push({
            id: post.id,
            date: post.date,
            title: cleanText(post.title),
            excerpt: makeExcerpt(content),
            content: content,
            tags: normalizeTags(Array.isArray(post.tags) ? post.tags.join(",") : post.tags),
            read: typeof post.read === "string" && post.read ? post.read : readMinutes(content),
            custom: true,
            createdAt: Number(post.createdAt) || 0
          });
        });
      }

      if (Array.isArray(saved.deleted)) {
        deletedDefaultIds = saved.deleted.filter(function (id) {
          return typeof id === "string" && id;
        });
      }

      if (typeof saved.pinnedId === "string" && saved.pinnedId) {
        pinnedId = saved.pinnedId;
      }
    }

    loadSaved();
    posts = posts.filter(function (post) {
      return post.custom || deletedDefaultIds.indexOf(post.id) === -1;
    });

    function getPost(id) {
      for (var i = 0; i < posts.length; i += 1) {
        if (posts[i].id === id) return posts[i];
      }
      return null;
    }

    var sortedPosts = posts.slice().sort(sortPosts);
    if (!getPost(pinnedId)) pinnedId = sortedPosts.length ? sortedPosts[0].id : "";
    featuredPost = getPost(pinnedId) || featuredPost;

    function saveState() {
      try {
        var customPosts = posts.filter(function (post) {
          return post.custom;
        }).map(function (post) {
          return {
            id: post.id,
            date: post.date,
            title: post.title,
            tags: post.tags,
            content: post.content,
            read: post.read,
            createdAt: post.createdAt
          };
        });
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          posts: customPosts,
          deleted: deletedDefaultIds,
          pinnedId: pinnedId
        }));
        return true;
      } catch (error) {
        return false;
      }
    }

    function setStatus(text, isError) {
      if (!statusLabel) return;
      window.clearTimeout(statusTimer);
      statusLabel.textContent = text;
      statusLabel.classList.toggle("is-error", Boolean(isError));
      if (text) {
        statusTimer = window.setTimeout(function () {
          statusLabel.textContent = "";
          statusLabel.classList.remove("is-error");
        }, 4200);
      }
    }

    function setFormMessage(text, isError) {
      if (!formMessage) return;
      formMessage.textContent = text;
      formMessage.classList.toggle("is-error", Boolean(isError));
    }

    function makeButton(text, attribute, id, label) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "post-action";
      button.textContent = text;
      button.setAttribute(attribute, id);
      if (label) button.setAttribute("aria-label", label);
      return button;
    }

    function appendTag(container, tag) {
      var chip = document.createElement("li");
      chip.className = "chip";
      chip.textContent = tag;
      container.appendChild(chip);
    }

    function renderFeatured() {
      var post = getPost(pinnedId) || posts.slice().sort(sortPosts)[0];

      if (!post) {
        pinnedId = "";
        if (featuredDate) {
          featuredDate.removeAttribute("datetime");
          featuredDate.textContent = "--------";
        }
        if (featuredMeta) featuredMeta.textContent = "LOCAL WRITER / NO ENTRIES";
        if (featuredTitle) featuredTitle.textContent = "NO ENTRIES YET";
        if (featuredExcerpt) {
          featuredExcerpt.textContent = "Publish a local entry to start the log. Everything stays in this browser.";
        }
        if (featuredBottom) {
          featuredBottom.textContent = "";
          var emptyNote = document.createElement("span");
          emptyNote.className = "pending";
          emptyNote.textContent = "NO PINNED ENTRY";
          featuredBottom.appendChild(emptyNote);
        }
        return;
      }

      pinnedId = post.id;

      if (featuredDate) {
        featuredDate.setAttribute("datetime", post.date);
        featuredDate.textContent = formatDate(post.date);
      }
      if (featuredMeta) {
        featuredMeta.textContent = post.tags.concat([post.read]).join(" / ");
      }
      if (featuredTitle) featuredTitle.textContent = post.title;
      if (featuredExcerpt) featuredExcerpt.textContent = post.excerpt;

      if (featuredBottom) {
        featuredBottom.textContent = "";
        post.tags.forEach(function (tag) {
          var chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = tag;
          featuredBottom.appendChild(chip);
        });
        var note = document.createElement("span");
        note.className = "pending";
        note.textContent = post.custom ? "PINNED / LOCAL ENTRY" : "PINNED / ARCHIVE EXCERPT";
        featuredBottom.appendChild(note);
        featuredBottom.appendChild(makeButton("READ", "data-blog-read", post.id, "Read " + post.title));
        featuredBottom.appendChild(makeButton("DEL", "data-blog-delete", post.id, "Delete " + post.title));
      }
    }

    function createRow(post) {
      var row = document.createElement("article");
      row.className = "post-row";
      row.setAttribute("data-blog-post", post.id);

      var date = document.createElement("time");
      date.className = "post-date";
      date.setAttribute("datetime", post.date);
      date.textContent = formatDate(post.date);

      var main = document.createElement("div");
      main.className = "post-main";
      var title = document.createElement("h3");
      title.className = "post-title";
      title.textContent = post.title;
      var excerpt = document.createElement("p");
      excerpt.className = "post-excerpt";
      excerpt.textContent = post.excerpt;
      main.appendChild(title);
      main.appendChild(excerpt);

      var tagList = document.createElement("ul");
      tagList.className = "post-tags";
      post.tags.forEach(function (tag) {
        appendTag(tagList, tag);
      });

      var side = document.createElement("div");
      side.className = "post-side";
      var read = document.createElement("span");
      read.className = "post-read";
      read.textContent = post.read;
      var actions = document.createElement("div");
      actions.className = "post-actions";
      actions.appendChild(makeButton("READ", "data-blog-read", post.id, "Read " + post.title));
      actions.appendChild(makeButton("PIN", "data-blog-pin", post.id, "Pin " + post.title + " as featured"));
      actions.appendChild(makeButton("DEL", "data-blog-delete", post.id, "Delete " + post.title));
      side.appendChild(read);
      side.appendChild(actions);

      row.appendChild(date);
      row.appendChild(main);
      row.appendChild(tagList);
      row.appendChild(side);
      return row;
    }

    function renderRows() {
      $$(".post-row", list).forEach(function (row) {
        row.remove();
      });
      var empty = $(".post-empty", list);
      if (empty) empty.remove();
      var pendingNote = $(".pending-note", list);
      var fragment = document.createDocumentFragment();
      var others = posts.filter(function (post) {
        return post.id !== pinnedId;
      }).sort(sortPosts);
      var visible = others.slice(0, visibleOthers);

      visible.forEach(function (post) {
        fragment.appendChild(createRow(post));
      });

      if (visible.length) {
        list.insertBefore(fragment, pendingNote || null);
      } else {
        var message = document.createElement("p");
        message.className = "post-empty";
        message.textContent = posts.length
          ? "NO OTHER ENTRIES / PIN ANOTHER ENTRY FROM THE LIST"
          : "NO ENTRIES YET / USE + NEW ENTRY";
        list.insertBefore(message, pendingNote || null);
      }

      if (moreButton) {
        var remaining = Math.max(0, others.length - visible.length);
        moreButton.hidden = remaining === 0;
        if (remaining > 0) {
          moreButton.textContent = "LOAD MORE ENTRIES / " + remaining + " HIDDEN";
        }
      }

      if (pendingNote) {
        var first = pendingNote.firstElementChild;
        if (first) first.textContent = "LOCAL READER / STORED IN THIS BROWSER";
      }
    }

    function renderSidebar() {
      if (tagCloud) {
        var seen = {};
        var allTags = [];
        posts.forEach(function (post) {
          post.tags.forEach(function (tag) {
            if (seen[tag]) return;
            seen[tag] = true;
            allTags.push(tag);
          });
        });
        var ordered = preferredTags.filter(function (tag) {
          return seen[tag];
        });
        allTags.sort().forEach(function (tag) {
          if (ordered.indexOf(tag) === -1) ordered.push(tag);
        });
        tagCloud.textContent = "";
        ordered.forEach(function (tag) {
          var chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = tag;
          tagCloud.appendChild(chip);
        });
        if (tagCount) tagCount.textContent = pad2(ordered.length);
      }

      if (archiveList) {
        var counts = {};
        posts.forEach(function (post) {
          var month = post.date.slice(0, 7);
          counts[month] = (counts[month] || 0) + 1;
        });
        var months = Object.keys(counts).sort().reverse();
        var years = [];
        archiveList.textContent = "";
        months.forEach(function (month) {
          var li = document.createElement("li");
          var label = document.createElement("span");
          label.textContent = month.replace("-", ".");
          var count = document.createElement("span");
          count.className = "count";
          count.textContent = pad2(counts[month]);
          li.appendChild(label);
          li.appendChild(count);
          archiveList.appendChild(li);
          var year = month.slice(0, 4);
          if (years.indexOf(year) === -1) years.push(year);
        });
        if (archiveYear) {
          archiveYear.textContent = years.length ? years.join(" / ") : "----";
        }
      }

      if (countLabel) {
        countLabel.textContent = pad2(posts.length) + " ENTRIES";
      }
    }

    function render() {
      renderFeatured();
      renderRows();
      renderSidebar();
    }

    function unlockPage() {
      if (!$("dialog[open]")) document.body.classList.remove("is-entry-open");
    }

    function showDialog(dialog, focusTarget, returnFocus) {
      dialog._returnFocus = returnFocus || document.activeElement;
      document.body.classList.add("is-entry-open");
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      if (focusTarget) {
        window.setTimeout(function () {
          focusTarget.focus();
        }, 0);
      }
    }

    function closeDialog(dialog) {
      if (dialog.open) dialog.close();
      else unlockPage();
    }

    [editor, reader].forEach(function (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) closeDialog(dialog);
      });
      dialog.addEventListener("close", function () {
        unlockPage();
        var returnFocus = dialog._returnFocus;
        dialog._returnFocus = null;
        if (returnFocus && document.contains(returnFocus)) {
          returnFocus.focus();
        }
      });
    });

    $$("[data-blog-editor-close]", editor).forEach(function (button) {
      button.addEventListener("click", function () {
        closeDialog(editor);
      });
    });
    var readerClose = $("[data-blog-reader-close]", reader);
    if (readerClose) {
      readerClose.addEventListener("click", function () {
        closeDialog(reader);
      });
    }

    function openEditor() {
      form.reset();
      dateInput.value = todayISO();
      pinInput.checked = true;
      setFormMessage("");
      showDialog(editor, dateInput, newButton);
    }

    function openReader(post, trigger) {
      if (!post) return;
      if (readerTitle) readerTitle.textContent = post.title;
      if (readerMeta) {
        readerMeta.textContent = formatDate(post.date) + " / " + post.read;
      }
      if (readerTags) {
        readerTags.textContent = "";
        post.tags.forEach(function (tag) {
          appendTag(readerTags, tag);
        });
      }
      if (readerContent) readerContent.textContent = post.content || post.excerpt;
      if (readerSource) {
        readerSource.textContent = post.custom
          ? "LOCAL ENTRY / STORED IN THIS BROWSER"
          : "ARCHIVE ENTRY / EXCERPT AVAILABLE";
      }
      showDialog(reader, readerClose || readerTitle, trigger || featured);
    }

    function pinPost(id) {
      if (!getPost(id) || id === pinnedId) return;
      pinnedId = id;
      var saved = saveState();
      render();
      setStatus(saved ? "PINNED TO FEATURED / LOCAL" : "PINNED / STORAGE BLOCKED", !saved);
      try {
        featured.scrollIntoView({ block: "start" });
      } catch (error) {
        /* scrolling is optional */
      }
      try {
        featured.focus({ preventScroll: true });
      } catch (error) {
        featured.focus();
      }
    }

    function resetDeleteConfirm() {
      window.clearTimeout(deleteTimer);
      deleteTimer = 0;
      deletePendingId = null;
      $$("[data-blog-delete]", page).forEach(function (button) {
        if (!button.classList.contains("is-confirming")) return;
        button.classList.remove("is-confirming");
        button.textContent = "DEL";
        var post = getPost(button.getAttribute("data-blog-delete"));
        if (post) button.setAttribute("aria-label", "Delete " + post.title);
      });
    }

    function deletePost(id) {
      var post = getPost(id);
      if (!post) return;
      posts = posts.filter(function (item) {
        return item.id !== id;
      });
      if (!post.custom && deletedDefaultIds.indexOf(id) === -1) {
        deletedDefaultIds.push(id);
      }
      if (pinnedId === id) {
        var remaining = posts.slice().sort(sortPosts);
        pinnedId = remaining.length ? remaining[0].id : "";
      }
      var saved = saveState();
      render();
      setStatus(saved ? "ENTRY DELETED / LOCAL" : "ENTRY DELETED / STORAGE BLOCKED", !saved);
      if (posts.length) {
        try {
          featured.scrollIntoView({ block: "start" });
        } catch (error) {
          /* scrolling is optional */
        }
        try {
          featured.focus({ preventScroll: true });
        } catch (error) {
          featured.focus();
        }
      } else {
        newButton.focus();
      }
    }

    function confirmDelete(id, button) {
      var post = getPost(id);
      if (!post) return;
      if (deletePendingId !== id) {
        resetDeleteConfirm();
        deletePendingId = id;
        deleteTimer = window.setTimeout(resetDeleteConfirm, 3200);
        if (button) {
          button.classList.add("is-confirming");
          button.textContent = "SURE?";
          button.setAttribute("aria-label", "Confirm delete " + post.title);
        }
        setStatus("DELETE AGAIN TO CONFIRM / LOCAL");
        return;
      }
      resetDeleteConfirm();
      deletePost(id);
    }

    page.addEventListener("click", function (event) {
      var remove = event.target.closest ? event.target.closest("[data-blog-delete]") : null;
      if (remove) {
        confirmDelete(remove.getAttribute("data-blog-delete"), remove);
        return;
      }

      if (deletePendingId) resetDeleteConfirm();

      var pin = event.target.closest ? event.target.closest("[data-blog-pin]") : null;
      if (pin) {
        pinPost(pin.getAttribute("data-blog-pin"));
        return;
      }
      var read = event.target.closest ? event.target.closest("[data-blog-read]") : null;
      if (read) {
        openReader(getPost(read.getAttribute("data-blog-read")), read);
        return;
      }
      if (event.target.closest && event.target.closest("[data-blog-new]")) {
        openEditor();
      }
    });

    if (moreButton) {
      moreButton.addEventListener("click", function () {
        var firstNewIndex = visibleOthers;
        resetDeleteConfirm();
        visibleOthers += pageSize;
        renderRows();
        var rows = $$(".post-row", list);
        var firstNew = rows[firstNewIndex];
        var firstAction = firstNew ? $(".post-action", firstNew) : null;
        if (firstAction) firstAction.focus();
      });
    }

    newButton.hidden = false;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var date = String(dateInput.value || "").trim();
      var title = cleanText(titleInput.value);
      var content = String(contentInput.value || "").trim();
      var tags = normalizeTags(tagsInput.value);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setFormMessage("CHECK THE DATE / REQUIRED", true);
        return;
      }
      if (!title) {
        setFormMessage("A TITLE IS REQUIRED", true);
        titleInput.focus();
        return;
      }
      if (!content) {
        setFormMessage("CONTENT IS REQUIRED", true);
        contentInput.focus();
        return;
      }

      var post = {
        id: "custom-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000),
        date: date,
        title: title,
        excerpt: makeExcerpt(content),
        content: content,
        tags: tags,
        read: readMinutes(content),
        custom: true,
        createdAt: Date.now()
      };
      posts.push(post);
      if (pinInput.checked || !pinnedId) pinnedId = post.id;
      var saved = saveState();
      render();
      closeDialog(editor);
      setStatus(saved ? "ENTRY PUBLISHED / LOCAL" : "ENTRY ADDED / STORAGE BLOCKED", !saved);
    });

    render();
    setStatus("");
  }

  /* Single-page routing ---------------------------------------------------- */
  function initRouter() {
    var main = $("#main");
    var routeSections = $$("[data-route]", main);
    if (!main || !routeSections.length) return;

    var navLinks = $$("[data-nav-route]");
    var footerPath = $("[data-footer-path]");
    var description = $('meta[name="description"]');
    var routes = {
      home: {
        title: "HELLO, HUSTER_ — HD 6.OS",
        description: "HD 6.OS — A brief introduction.",
        path: ""
      },
      about: {
        title: "ABOUT — HD 6.OS",
        description: "陈俊男 — builder of a terminal-style personal node.",
        path: "about"
      },
      work: {
        title: "WORK — HD 6.OS",
        description: "HD 6.OS project index: WEB, TOOL, and LAB. Six shipped or in-progress nodes.",
        path: "work"
      },
      blog: {
        title: "BLOG — HD 6.OS",
        description: "HD 6.OS build logs and notes: CSS, tooling, local-first, and long reads.",
        path: "blog"
      },
      toolcase: {
        title: "TOOLCASE — HD 6.OS",
        description: "HD 6.OS local toolbox: timestamp conversion, JSON, contrast, UUID, Base64, Morse, Caesar, base conversion, and mirage-tank images. All data stays in the browser.",
        path: "toolcase"
      },
      atlas: {
        title: "ATLAS — HD 6.OS",
        description: "HD 6.OS world map: a set of nodes, a few signal loops, and coordinates left by the cursor.",
        path: "atlas"
      }
    };

    var currentRoute = "";

    function hashFor(name) {
      return name === "home" ? "#/" : "#/" + name;
    }

    function parseHash() {
      var raw = window.location.hash || "";
      if (!raw || raw === "#" || raw === "#/" || raw === "#/home") return "home";
      if (raw.indexOf("#/") === 0) {
        var key = raw.slice(2).replace(/\/+$/, "");
        if (key === "" || key === "home") return "home";
        if (routes[key]) return key;
      }
      return "home";
    }

    function locked() {
      return document.body.classList.contains("is-scanning") ||
        document.body.classList.contains("is-code-mode") ||
        document.body.classList.contains("is-entry-open");
    }

    function setHashSilently(name) {
      try {
        window.history.replaceState(null, "", hashFor(name));
      } catch (error) {
        /* file:// can reject history writes in some browsers */
      }
    }

    function applyRoute(name, shouldFocus) {
      if (!routes[name]) name = "home";

      if (currentRoute && locked() && name !== currentRoute) {
        setHashSilently(currentRoute);
        return;
      }

      currentRoute = name;

      routeSections.forEach(function (section) {
        section.hidden = section.getAttribute("data-route") !== name;
      });

      navLinks.forEach(function (link) {
        var active = link.getAttribute("data-nav-route") === name;
        link.classList.toggle("is-active", active);
        if (active) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });

      if (description) description.setAttribute("content", routes[name].description);
      document.title = routes[name].title;

      if (footerPath) {
        footerPath.textContent = routes[name].path ? "PATH /" + routes[name].path : "PATH /";
      }

      document.dispatchEvent(new CustomEvent("spa:route", {
        detail: { route: name }
      }));

      window.scrollTo(0, 0);

      if (shouldFocus) {
        try {
          main.focus({ preventScroll: true });
        } catch (error) {
          main.focus();
        }
      }
    }

    document.body.classList.add("is-spa");

    var initialRoute = parseHash();
    applyRoute(initialRoute, false);

    var rawHash = window.location.hash || "";
    if (rawHash && rawHash !== hashFor(initialRoute)) {
      setHashSilently(initialRoute);
    }

    window.addEventListener("hashchange", function () {
      var nextRoute = parseHash();
      if (nextRoute === currentRoute) {
        if (window.location.hash && window.location.hash !== hashFor(currentRoute)) {
          setHashSilently(currentRoute);
        } else {
          window.scrollTo(0, 0);
        }
        return;
      }
      applyRoute(nextRoute, true);
      if (currentRoute === nextRoute && window.location.hash && window.location.hash !== hashFor(nextRoute)) {
        setHashSilently(nextRoute);
      }
    });

    var skipLink = $("[data-skip-link]");
    if (skipLink) {
      skipLink.addEventListener("click", function (event) {
        event.preventDefault();
        try {
          main.focus({ preventScroll: true });
        } catch (error) {
          main.focus();
        }
        main.scrollIntoView({ block: "start" });
      });
    }
  }

  /* Homepage manifest counters --------------------------------------------- */
  function initManifestMetrics() {
    var projectValue = $("[data-manifest-projects]");
    var notesValue = $("[data-manifest-notes]");
    var toolValue = $("[data-manifest-tools]");
    var notesSource = $("[data-blog-count]");
    var projects = $$('[data-route="work"] .project').length;
    var tools = $$('[data-route="toolcase"] .tool').length;

    function pad(value) {
      return value < 10 ? "0" + value : String(value);
    }

    function write() {
      if (projectValue) projectValue.textContent = pad(projects);
      if (toolValue) toolValue.textContent = pad(tools);
      if (!notesValue) return;
      var match = notesSource ? String(notesSource.textContent || "").match(/\d+/) : null;
      if (match) notesValue.textContent = pad(parseInt(match[0], 10));
    }

    write();
    if (notesSource && window.MutationObserver) {
      new MutationObserver(write).observe(notesSource, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }

  function init() {
    initClock();
    initWorkFilter();
    initTimestamp();
    initJson();
    initContrast();
    initUuid();
    initBase64();
    initMorse();
    initCaesar();
    initBaseConverter();
    initMirage();
    initDeskpet();
    initPetPlayer();
    initCodeRain();
    initContactFlow();
    initAtlas();
    initBlog();
    initManifestMetrics();
    initRouter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
