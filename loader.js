(async () => {
  const ENVIRONMENT_IS_WEB = typeof window == 'object';
  const ENVIRONMENT_IS_WORKER = typeof importScripts == 'function';

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
        if (path == "solver_1.wasm" && m.data.wasmBinaryFile) {
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

      let register_fns = [];
      params["gf_fs_reg_all"] = (fsess, a_sess) => {
        const filters = register_fns.map(filter => module[filter](a_sess));
        filters.map(filter => module.ccall('gf_fs_add_filter_register', null, ['number', 'number'], [fsess, filter]));
      };

      let on_done_resolve = null;
      let on_done_reject = null;

      params["gpac_done"] = (code) => {
        //const props  = getProperty(["width", "height"]);
        if (code) console.log('(exit code ' + code + ')');
        const message = {
          "exit_code": code
        };

        if (m.data.dst) {
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

      module = await libgpac(params);
      const FS = module['FS'];


      // Reframer and resampler
      register_fns.push("_reframer_register");
      register_fns.push("_resample_register");
      register_fns.push("_compositor_register");

      let vbench = false;
      if (m.data.vbench != null) {
        vbench = true;
      }

      if (m.data.src) {
        register_fns.push("_fin_register");
        const src = m.data.src;
        const response = await fetch(src);
        var fname = src.split('/').pop();
        const data = await response.arrayBuffer();
        FS.writeFile(fname, new Uint8Array(data));
        if (vbench == true){
          args.push("-vbench");
        }else{
          args.push("-i");
        }

        args.push(fname);
      }

      if (m.data.transcode) {
        args = args.concat(m.data.transcode);
      }


      if (m.data.dst) {
        register_fns.push("_writegen_register");
        register_fns.push("_fout_register");
        args.push("-o");
        args.push(m.data.dst);
      } else if (vbench == false){
        register_fns.push("_aout_register");
        register_fns.push("_vout_register");
        args.push("aout");

        if (m.data.width != null && m.data.height != null) {
          args.push("vout:wsize=" + m.data.width + "x" + m.data.height);
        } else {
          args.push("vout");
        }
      }

      if (m.data.useWebcodec) {
        register_fns.push("_wcdec_register");
        register_fns.push("_wcenc_register");
        register_fns.push("_webgrab_register");
      }

      register_fns = register_fns.concat(Object.keys(module).filter(x => x.startsWith("dynCall_") && x.endsWith("_register")));

      if (m.data.showStats != null) {
        args.push("-stats");
      }

      if (m.data.showGraph != null) {
        args.push("-graph");
      }

      if (m.data.showReport != null) {
        args.push("-r");
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
        libgpac.gf_fs_reg_all = params["gf_fs_reg_all"];
        libgpac.gpac_done = params["gpac_done"];

        GPAC.stack = module.stackSave();
        args.unshift("gpac");
        var argc = args.length;
        var argv = module.stackAlloc((argc + 1) * 4);
        var argv_ptr = argv >> 2;
        args.forEach(arg => {
          module.HEAP32[argv_ptr++] = module.allocateUTF8OnStack(arg);
        });
        module.HEAP32[argv_ptr] = 0;

        //const gpac_em_sig_handler = module.cwrap('gpac_em_sig_handler', null, ['number']);
        //gpac_em_sig_handler(4);
        //setProperty({"graph":m.data.showGraph != null, "report":m.data.showReport  != null, "stats":m.data.showStats  != null})
        try {
          module["_main"](argc, argv);
        } catch (e) {
          //unwind thrown by emscripten main
          if (e != 'unwind') {
            console.log(e);
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
