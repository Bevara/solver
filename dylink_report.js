/*
 * Replaces emscripten's $reportUndefinedSymbols (src/lib/libdylink.js), which
 * runs after the side modules are loaded and resolves what they import from
 * the main module.
 *
 * Upstream names a required symbol nobody provides only under ASSERTIONS:
 *
 *     #if ASSERTIONS
 *       assert(value, `undefined symbol '${symName}'. perhaps a side module ...`);
 *     #endif
 *
 * In a release build that line is compiled out, `value` is undefined, and the
 * very next test - `typeof value.value` - throws
 *
 *     TypeError: Cannot read properties of undefined (reading 'value')
 *
 * which is all a page ever saw when an accessor wanted something this solver
 * does not export: the Showcase avif and midi demos, and libheif on the build
 * agent, all died on that line without one of them saying which symbol, or
 * that a symbol was the problem at all.
 *
 * Same resolution as upstream, plus the missing case handled: every required
 * symbol left unresolved is collected, and one error names them all together
 * with the side modules that were loaded. It carries them as properties too,
 * so the loader can report them as data rather than as a string to parse.
 */
addToLibrary({
  $reportUndefinedSymbols__internal: true,
  $reportUndefinedSymbols__deps: ['$GOT', '$resolveGlobalSymbol', '$addFunction', '$UNDEFINED_ADDR', '$POINTER_JS_TYPE'],
  $reportUndefinedSymbols: () => {
    var missing = [];
    for (var [symName, entry] of Object.entries(GOT)) {
      if (entry.value == UNDEFINED_ADDR) {
        var value = resolveGlobalSymbol(symName, true).sym;
        if (!value && !entry.required) {
          // Ignore undefined symbols that are imported as weak.
          entry.value = {{{ to64(0) }}};
          continue;
        }
        if (!value) {
          missing.push(symName);
          continue;
        }
        if (typeof value === 'function') {
          /** @suppress {checkTypes} */
          entry.value = {{{ to64('addFunction(value, value.sig)') }}};
        } else if (typeof value === 'number') {
          entry.value = {{{ to64('value') }}};
        } else if (typeof value.value === POINTER_JS_TYPE) {
          entry.value = value;
        } else {
          throw new Error(`bad export type for '${symName}': ${typeof value} (${value})`);
        }
      }
    }
    if (missing.length) {
      var libs = (typeof dynamicLibraries != 'undefined' ? dynamicLibraries : [])
        .map((l) => String(l).split('?')[0].split('/').pop());
      var shown = missing.slice(0, 40).join(', ') + (missing.length > 40 ? `, ... (${missing.length - 40} more)` : '');
      var err = new Error(
        `${missing.length} symbol${missing.length > 1 ? 's' : ''} required by ` +
        (libs.length ? libs.join(', ') : 'a side module') +
        ` ${missing.length > 1 ? 'are' : 'is'} not exported by this solver: ${shown}`);
      err.name = 'UndefinedSymbols';
      err.missingSymbols = missing;
      err.sideModules = libs;
      throw err;
    }
  },
});
