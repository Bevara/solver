(async () => {
  const ENVIRONMENT_IS_WEB = typeof window == 'object';
  const ENVIRONMENT_IS_WORKER = typeof importScripts == 'function';

  if (ENVIRONMENT_IS_WORKER) {
    const oldError = console.error;
    console.error = function (...args) {
      postMessage({ exit_code: -1, printErr: "WORKER CONSOLE.ERROR: " + args.join(' ') });
      if (oldError) oldError.apply(console, args);
    };
    const oldWarn = console.warn;
    console.warn = function (...args) {
      postMessage({ exit_code: -1, printErr: "WORKER CONSOLE.WARN: " + args.join(' ') });
      if (oldWarn) oldWarn.apply(console, args);
    };
  }

  // Include ANSI escape codes convert
  // @link: https://www.npmjs.com/package/ansi-html
  // Reference to https://github.com/sindresorhus/ansi-regex
  var _regANSI = /(?:(?:\u001b\[)|\u009b)(?:(?:[0-9]{1,3})?(?:(?:;[0-9]{0,3})*)?[A-M|f-m])|\u001b[A-M]/

  var _defColors = {
    reset: ['fff', '000'], // [FOREGROUD_COLOR, BACKGROUND_COLOR]
    black: '000',
    red: 'ff0000',
    green: '209805',
    yellow: 'e8bf03',
    blue: '0000ff',
    magenta: 'ff00ff',
    cyan: '00ffee',
    lightgrey: 'f0f0f0',
    darkgrey: '888'
  };
  var _styles = {
    30: 'black',
    31: 'red',
    32: 'green',
    33: 'yellow',
    34: 'blue',
    35: 'magenta',
    36: 'cyan',
    37: 'lightgrey'
  };
  var _openTags = {
    '1': 'font-weight:bold', // bold
    '2': 'opacity:0.5', // dim
    '3': '<i>', // italic
    '4': '<u>', // underscore
    '8': 'display:none', // hidden
    '9': '<del>' // delete
  };
  var _closeTags = {
    '23': '</i>', // reset italic
    '24': '</u>', // reset underscore
    '29': '</del>' // reset delete
  };

  [0, 21, 22, 27, 28, 39, 49].forEach(function (n) {
    _closeTags[n] = '</span>'
  });

  /**
  * Converts text with ANSI color codes to HTML markup.
  * @param {String} text
  * @returns {*}
  */
  function ansiHTML(text) {
    // Returns the text if the string has no ANSI escape code.
    if (!_regANSI.test(text)) {
      return text
    }

    // Cache opened sequence.
    var ansiCodes = []
    // Replace with markup.
    var ret = text.replace(/\033\[(\d+)m/g, function (match, seq) {
      if (seq == '0') {
        r = '';
        ansiCodes.forEach(c => {
          if (c == '3') r += '</i>';
          else if (c == '4') r += '</b>';
        });
        ansiCodes.length = 0;
        return r + '</span>';
      }
      var ot = _openTags[seq]
      if (ot) {
        // If current sequence has been opened, close it.
        if (!!~ansiCodes.indexOf(seq)) { // eslint-disable-line no-extra-boolean-cast
          ansiCodes.pop()
          return '</span>'
        }
        // Open tag.
        ansiCodes.push(seq)
        return ot[0] === '<' ? ot : '<span style="' + ot + ';">'
      }

      var ct = _closeTags[seq]
      if (ct) {
        // Pop sequence
        ansiCodes.pop()
        return ct
      }
      return '';
    });

    // Make sure tags are closed.
    var l = ansiCodes.length
      ; (l > 0) && (ret += Array(l + 1).join('</span>'));

    return ret;
  }

  /**
      * Customize colors.
      * @param {Object} colors reference to _defColors
      */
  ansiHTML.setColors = function (colors) {
    if (typeof colors !== 'object') {
      throw new Error('`colors` parameter must be an Object.')
    }

    var _finalColors = {}
    for (var key in _defColors) {
      var hex = colors.hasOwnProperty(key) ? colors[key] : null
      if (!hex) {
        _finalColors[key] = _defColors[key]
        continue
      }
      if ('reset' === key) {
        if (typeof hex === 'string') {
          hex = [hex]
        }
        if (!Array.isArray(hex) || hex.length === 0 || hex.some(function (h) {
          return typeof h !== 'string'
        })) {
          throw new Error('The value of `' + key + '` property must be an Array and each item could only be a hex string, e.g.: FF0000')
        }
        var defHexColor = _defColors[key]
        if (!hex[0]) {
          hex[0] = defHexColor[0]
        }
        if (hex.length === 1 || !hex[1]) {
          hex = [hex[0]]
          hex.push(defHexColor[1])
        }

        hex = hex.slice(0, 2)
      } else if (typeof hex !== 'string') {
        throw new Error('The value of `' + key + '` property must be a hex string, e.g.: FF0000')
      }
      _finalColors[key] = hex
    }
    _setTags(_finalColors)
  };

  /**
   * Reset colors.
   */
  ansiHTML.reset = function () {
    _setTags(_defColors)
  };

  /**
   * Expose tags, including open and close.
   * @type {Object}
   */
  ansiHTML.tags = {}

  if (Object.defineProperty) {
    Object.defineProperty(ansiHTML.tags, 'open', {
      get: function () { return _openTags }
    })
    Object.defineProperty(ansiHTML.tags, 'close', {
      get: function () { return _closeTags }
    })
  } else {
    ansiHTML.tags.open = _openTags
    ansiHTML.tags.close = _closeTags
  }

  function _setTags(colors) {
    // reset all
    _openTags['0'] = 'font-weight:normal;opacity:1;color:#' + colors.reset[0] + ';background:#' + colors.reset[1]
    // inverse
    _openTags['7'] = 'color:#' + colors.reset[1] + ';background:#' + colors.reset[0]
    // dark grey
    _openTags['90'] = 'color:#' + colors.darkgrey

    for (var code in _styles) {
      var color = _styles[code]
      var oriColor = colors[color] || '000'
      _openTags[code] = 'color:#' + oriColor
      code = parseInt(code)
      _openTags[(code + 10).toString()] = 'background:#' + oriColor
    }
  }

  ansiHTML.reset();

  async function initSolver() {


    let module = null;

    let statusElement = null;
    let graphElement = null;
    let reportElement = null;
    let statsElement = null;

    function get_properties(props) {
      const json_str = JSON.stringify(props);
      var res = module.ccall('get_properties', // name of C function
        'string', // return type
        ['string'], // argument types
        [json_str]);
      return JSON.parse(res);
    }

    function get_property(prop) {
      return module.ccall('get_property', // name of C function
        'string', // return type
        ['string'], // argument types
        [prop]);
    }

    function destroy() {
      return module.ccall('destroy', // name of C function
        null, // return type
        [], // argument types
        []);
    }

    function set_properties(props) {
      const json_str = JSON.stringify(props);
      var res = module.ccall('set_properties', // name of C function
        'string', // return type
        ['string'], // argument types
        [json_str]);
      return JSON.parse(res);
    }

    async function init(m) {
      const params = m.data.module ? m.data.module : {};
      let args = [];

      params["locateFile"] = function (path, scriptDirectory) {
        if (path.includes("solver") && path.endsWith(".wasm") && m.data.wasmBinaryFile) {
          return m.data.wasmBinaryFile;
        }
        return path;
      };

      const module_parameters = m.data.module;
      if (m.data.print) {
        params["print"] = function () {
          if (ENVIRONMENT_IS_WORKER) {
            return function (t) {
              postMessage({ print: t, ref: m.data.args });
            };
          } else if (ENVIRONMENT_IS_WEB) {
            var element = document.getElementById(m.data.print);
            if (element) element.value = ''; // clear browser cache
            return function (text) {
              if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
              // These replacements are necessary if you render to raw HTML
              text = text.replace(/&/g, "&amp;");
              text = text.replace(/</g, "&lt;");
              text = text.replace(/>/g, "&gt;");
              text = text.replace('\n', '<br>', 'g');

              // handle \r
              var prevPos = 0;
              var output = '';
              for (var i = 0; i < text.length; i++) {
                if (text.charCodeAt(i) == 13) {
                  output += text.substring(prevPos, i);
                  prevPos = i + 1;
                }
              }

              // convert ANSI colors to HTML
              text = ansiHTML(text);

              if (element) {
                element.innerHTML += text + "<br>";
                element.scrollTop = element.scrollHeight; // focus on bottom
              }
            };
          }
        }();
      }

      if (m.data.printErr) {
        params["printErr"] = function () {
          if (ENVIRONMENT_IS_WORKER) {
            return function (t) {
              postMessage({ print: t, ref: m.data.args });
            };
          } else if (ENVIRONMENT_IS_WEB) {
            var element = document.getElementById(m.data.printErr);
            if (element) element.value = ''; // clear browser cache
            return function (text) {
              if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
              // These replacements are necessary if you render to raw HTML
              text = text.replace(/&/g, "&amp;");
              text = text.replace(/</g, "&lt;");
              text = text.replace(/>/g, "&gt;");
              text = text.replace('\n', '<br>', 'g');

              // handle \r
              var prevPos = 0;
              var output = '';
              for (var i = 0; i < text.length; i++) {
                if (text.charCodeAt(i) == 13) {
                  output += text.substring(prevPos, i);
                  prevPos = i + 1;
                }
              }

              // convert ANSI colors to HTML
              text = ansiHTML(text);

              if (GPAC.no_log)
                console.log(text);
              else if (element) {
                element.innerHTML += text + "<br>";
                element.scrollTop = element.scrollHeight; // focus on bottom
              }
            };
          }
        }();
      }

      let on_done_resolve = null;
      let on_done_reject = null;

      /* Lecture progressive par Media Source Extensions.
       *
       * Au lieu de muxer un fichier unique et de rendre un seul blob a la fin,
       * on fait ecrire au dasher un segment d'initialisation puis des segments
       * numerotes dans le FS virtuel, et on remet chacun a m.data.onProgress
       * des qu'il est complet - c'est ce que l'appelant pousse dans un
       * SourceBuffer.
       *
       * Modele sur l'exemple de la console WASM de gpac
       *   gpac -i <url> dashin:forward=file -o 'dump/$File$':dynext
       * un fichier par segment, ecrit puis ferme.
       *
       * Un segment n'est considere complet que lorsque le dasher est passe au
       * suivant - ou, pour le dernier, a la fin de session. C'est deterministe,
       * contrairement a une heuristique sur la taille du fichier. */
      const SEG_DIR = "dash";
      const SEG_INIT = SEG_DIR + "/seg_init.mp4";
      let segTimer = null, segNext = 1, segInitDone = false;

      function segExists(path) {
        try { FS.stat(path); return true; } catch (e) { return false; }
      }
      function segPush(path) {
        const data = FS.readFile(path, { encoding: "binary" });
        m.data.onProgress(data);
        /* le FS virtuel vit dans la memoire du module : on libere chaque
         * segment une fois remis, sinon un transcodage long garderait toute
         * la sortie en memoire */
        try { FS.unlink(path); } catch (e) {}
      }
      function segFlush(final) {
        if (!m.data.onProgress) return;
        if (!segInitDone) {
          if (!segExists(SEG_INIT)) return;
          segPush(SEG_INIT);
          segInitDone = true;
        }
        for (;;) {
          const cur = SEG_DIR + "/seg_" + segNext + ".m4s";
          if (!segExists(cur)) break;
          if (!final && !segExists(SEG_DIR + "/seg_" + (segNext + 1) + ".m4s")) break;
          segPush(cur);
          segNext++;
        }
      }
      if (m.data.progressive && m.data.onProgress) {
        try { FS.mkdir(SEG_DIR); } catch (e) {}
        segTimer = setInterval(() => segFlush(false), 200);
      }



      params["gpac_done"] = (code) => {
        //const props  = getProperty(["width", "height"]);
        if (code) console.log('(exit code ' + code + ')');
        const message = {
          "exit_code": code
        };

        if (segTimer) {
          clearInterval(segTimer);
          segTimer = null;
          //le dernier segment n'a pas de successeur : la fin de session fait foi
          segFlush(true);
          if (m.data.onProgressDone) m.data.onProgressDone();
        }

        //in progressive mode the element is already fed through the SourceBuffer,
        //there is no final blob to hand back
        if (m.data.dst && !m.data.progressive) {
          try {
            const res = FS.readFile(m.data.dst, { encoding: "binary" });
            if (m.data.mime_type) {
              message["blob"] = new Blob([res], { type: m.data.mime_type });
            }

            else {
              message["blob"] = new Blob([res], { type: "application/octet-stream" });
            }

          } catch (e) {
            message["blob"] = null;
          }
        }

        if (ENVIRONMENT_IS_WORKER) {
          postMessage(message);
        } else if (ENVIRONMENT_IS_WEB) {
          on_done_resolve(message);
        }
      };

      try {
        module = await libgpac(params);
      } catch (e) {
        console.log(e);
        if (ENVIRONMENT_IS_WORKER) {
          postMessage({ exit_code: -1, printErr: "WORKER EXCEPTION in libgpac: " + (e.stack || e) });
        } else if (ENVIRONMENT_IS_WEB) {
          if (on_done_reject) on_done_reject(e);
        }
        return;
      }
      const FS = module['FS'];


      //From gpac_pre.js
      const SIZE_I32 = Uint32Array.BYTES_PER_ELEMENT;
      module["SIZE_I32"] = SIZE_I32;
      function stringToPtr(str) {
        const len = module["lengthBytesUTF8"](str) + 1;
        const ptr = module["_malloc"](len);
        module["stringToUTF8"](str, ptr, len);

        return ptr;
      }
      module["stringsToPtr"] = stringsToPtr;

      function stringsToPtr(strs) {
        const len = strs.length;
        const ptr = module["_malloc"](len * SIZE_I32);
        for (let i = 0; i < len; i++) {
          module["setValue"](ptr + SIZE_I32 * i, stringToPtr(strs[i]), "i32");
        }

        return ptr;
      }

      module["stringToPtr"] = stringToPtr;

      function registerFilter(filter_name, register_func_name) {
        const reg_fn = module[register_func_name];

        if (typeof reg_fn !== 'function') {
          console.error(`Can't find function in loader : ${register_func_name}`);
          return false;
        }

        const funcPtr = module.addFunction(reg_fn, 'ip');
        const namePtr = module.stringToPtr(filter_name);

        try {
          module.ccall(
            'gf_filter_auto_register',
            null,
            ['number', 'number'],
            [namePtr, funcPtr]
          );
          console.log(`Filter "${filter_name}" has been registered by the loader.`);
        } catch {
          console.log(`Error : Filter "${filter_name}" has not been registered by the loader.`);
        } finally {
          module._free(namePtr);
        }
      }

      // Reframer and resampler
      registerFilter("reframer", "_reframer_register");
      registerFilter("resample", "_resample_register");

      /* Le dasher n'est charge que pour une sortie video progressive : c'est lui
       * qui decoupe le flux en segments ecrits un a un dans le FS virtuel, que
       * segFlush() ci-dessus remet a MSE au fur et a mesure. */
      if (m.data.progressive) {
        registerFilter("dasher", "_dasher_register");
      }

      if (m.data.src) {
        registerFilter("httpin", "_httpin_register");

        if (m.data.interactive || m.data.vr) {
          registerFilter("compositor", "_compositor_register");
          let interactive_mode = "compositor:player=base:src=" + m.data.src;
          if (m.data.vr) {
            interactive_mode = interactive_mode + "#VR";
          }
          args.push(interactive_mode);
        } else {
          args.push("-i");
          /* #Representation=1 place toutes les pistes dans une seule
           * representation DASH, donc un seul SourceBuffer cote MSE au lieu
           * d'un par piste. ":gpac:" est le mot-cle d'echappement documente
           * pour les URL - sans lui les options resteraient collees a l'URL. */
          args.push(m.data.progressive ? (m.data.src + ":gpac:#Representation=1") : m.data.src);
        }
      }

      if (m.data.transcode) {
        // A bare codec constraint, not prefixed with a specific filter
        // name. GPAC's normal filter-graph resolution then picks whichever
        // AVC-capable filter is actually registered and connects - "wcenc"
        // only if useWebcodec registered it above, otherwise whatever
        // encoder is listed in "with" (e.g. libx264_1's encx264). Forcing
        // "wcenc:" here unconditionally used to hijack that resolution
        // even when wcenc was never wanted, leaving no video track in the
        // output.
        /* En mode progressif, chaque segment doit pouvoir commencer sur une
         * image cle : sans cela le dasher ne peut couper qu'au GOP (250 images
         * par defaut chez x264, soit 10 s) et signale une derive croissante.
         * gopdur exprime l'intervalle en secondes, independamment de la cadence. */
        const constraints = m.data.progressive
          ? m.data.transcode.map(c => c === "c=avc" ? ("c=avc:gopdur=" + (m.data.seg_dur || 1)) : c)
          : m.data.transcode;
        args = args.concat(constraints);

        if (m.data.useWebcodec) {
          // enc_webcodec.c's EM_JS output callback holds back every wcenc
          // instance's first chunk until this many instances have each
          // produced one, so mp4mx never receives one track's
          // init/fragment well ahead of the other's (which MSE rejects
          // outright).
          libgpac.wcencExpectedCount = m.data.transcode.length;
        }
      }


      if (m.data.interactive || m.data.vr) {
        registerFilter("aout", "_aout_register");
        registerFilter("vout", "_vout_register");
      } else if (m.data.dst) {
        registerFilter("writegen", "_writegen_register");
        registerFilter("fout", "_fout_register");
        args.push("-o");
        if (m.data.progressive) {
          /* profile=live rend chaque segment autonome. Le gabarit est fixe ici
           * parce que segFlush() ci-dessus parcourt les segments par leur nom.
           * sbound=closest : couper au SAP le plus proche de la borne plutot que
           * de l'imposer - MSE n'exige pas des segments de duree egale, seulement
           * une timeline contigue. stl : timeline de segments, pour decrire les
           * durees reelles et eviter un faux signalement de derive. */
          args.push(SEG_DIR + "/live.mpd:profile=live:muxtype=mp4"
            + ":segdur=" + (m.data.seg_dur || 1)
            + ":segext=m4s:initext=mp4:template=seg_$Init=init$$Number$"
            + ":sbound=closest"
            + ":stl");
        } else {
          args.push(m.data.dst_opts ? (m.data.dst + ":" + m.data.dst_opts) : m.data.dst);
        }
      } else if (m.data.vbench == false) {
        registerFilter("aout", "_aout_register");
        registerFilter("vout", "_vout_register");

        // TODO : Added for fluidity, need testing
        args.push("-step=200");

        if (m.data.width != null && m.data.height != null) {
          args.push("vout:wsize=" + m.data.width + "x" + m.data.height);
          args.push("aout");
        } else {
          args.push("vout");
          args.push("aout");
        }
      } else {
        registerFilter("vout", "_vout_register");
        args.push("vout:!vsync");
      }

      if (m.data.useWebcodec) {
        registerFilter("wcdec", "_wcdec_register");
        registerFilter("wcenc", "_wcenc_register");
        registerFilter("webgrab", "_webgrab_register");
      }

      if (m.data.showStats != null) {
        args.push("-stats");
      }

      if (m.data.showGraph != null) {
        args.push("-graph");
      }

      if (m.data.showReport != null) {
        args.push("-r=");
      }

      if (m.data.showLogs != null) {
        args.push("-logs=" + m.data.showLogs);
      }

      if (m.data.noCleanupOnExit != null) {
        args.push("-qe");
      }

      if (m.data.loop != null && m.data.loop == true) {
        args.push("-sloop");
      }

      if (m.data.test != null) {
        args.push("-for-test");
      }

      const GPAC = {};

      //setProperty(args);
      function call_gpac() {

        //FIXME
        libgpac._on_wcdec_error = module.cwrap('wcdec_on_error', null, ['number', 'number', 'string']);
        libgpac._on_wcdec_frame = module.cwrap('wcdec_on_video', null, ['number', 'bigint', 'string', 'number', 'number']);
        libgpac._on_wcdec_audio = module.cwrap('wcdec_on_audio', null, ['number', 'bigint', 'string', 'number', 'number', 'number']);
        libgpac._on_wcdec_flush = module.cwrap('wcdec_on_flush', null, ['number']);
        libgpac._on_wcdec_frame_copy = module.cwrap('wcdec_on_frame_copy', null, ['number', 'number', 'number']);
        module["_on_wcdec_error"] = libgpac._on_wcdec_error;
        module["_on_wcdec_frame"] = libgpac._on_wcdec_frame;
        module["_on_wcdec_audio"] = libgpac._on_wcdec_audio;
        module["_on_wcdec_flush"] = libgpac._on_wcdec_flush;
        module["_on_wcdec_frame_copy"] = libgpac._on_wcdec_frame_copy;
        module["gpac_done"] = params["gpac_done"];

        GPAC.stack = module.stackSave();
        args.unshift("gpac");
        var argc = args.length;
        var argv = module.stringsToPtr(args);

        //const gpac_em_sig_handler = module.cwrap('gpac_em_sig_handler', null, ['number']);
        //gpac_em_sig_handler(4);
        //setProperty({"graph":m.data.showGraph != null, "report":m.data.showReport  != null, "stats":m.data.showStats  != null})
        try {
          module["_main"](argc, argv);
        } catch (e) {
          //unwind thrown by emscripten main
          if (e != 'unwind') {
            console.log(e);
            if (ENVIRONMENT_IS_WORKER) {
              postMessage({ exit_code: -1, printErr: "WORKER EXCEPTION: " + (e.stack || e) });
            } else if (ENVIRONMENT_IS_WEB) {
              if (on_done_reject) on_done_reject(e);
            }
          }
        }
      };

      if (ENVIRONMENT_IS_WEB) {
        return new Promise((resolve, reject) => {
          on_done_resolve = resolve;
          on_done_reject = reject;
          call_gpac();
        });
      } else {
        call_gpac();
      }
    };

    async function handle_message(m) {
      let res = null;
      switch (m.data.event) {
        case "init":
          res = await init(m);
          break;
        case "set_properties":
          res = set_properties(m.data.properties);
          break;
        case "get_properties":
          res = get_properties(m.data.properties);
          break;
        case "get_property":
          res = get_property(m.data.property);
          break;
        case "destroy":
          res = destroy();
          break;
        default:
      }

      if (ENVIRONMENT_IS_WORKER) {
        if (res && res.then == null) {
          postMessage(res);
        }
      } else if (ENVIRONMENT_IS_WEB) {
        return res;
      }
    }
    return handle_message;
  }

  if (ENVIRONMENT_IS_WORKER) {
    const handle_message = await initSolver();
    addEventListener("message", handle_message);
  } else if (ENVIRONMENT_IS_WEB) {
    window.solver_1 = initSolver;
  }
})();
