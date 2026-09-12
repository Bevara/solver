#!/usr/bin/env python3
"""Derive the SIDE_MODULES export list for a MAIN_MODULE=2 solver.

With MAIN_MODULE=2 the solver only exports what exports.cmake names, and a
side module whose import nothing satisfies does not instantiate. So the list
is derived, not written: the union of every filter's env/GOT.mem/GOT.func
imports, minus what each filter exports itself (weak symbols, C++ templates
are imported and exported at once), minus what the JS glue supplies
(wasmImports keys, and invoke_* which it synthesises on demand), kept only
where the solver actually defines the symbol - a MAIN_MODULE=1 build of it,
which exports everything it defines, is the reference for that.

    python3 solver/tools/side_module_exports.py build/dist/solver_1.wasm build/dist/*_1.wasm

Prints the symbols with the exports.cmake leading underscore, sorted, ready
to paste; with -v, also who imports each one. Run it again whenever a filter
is added or rebuilt, and diff.
"""
import sys, re, os

def leb(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if not c & 0x80:
            return r, i

def sections(b):
    i = 8
    while i < len(b):
        sid = b[i]; i += 1; n, i = leb(b, i); yield sid, b[i:i + n]; i += n

def limits(p, i):
    f = p[i]; i += 1; _, i = leb(p, i)
    if f & 1:
        _, i = leb(p, i)
    return i

def imports(path):
    b = open(path, 'rb').read(); out = []
    for sid, p in sections(b):
        if sid != 2:
            continue
        n, i = leb(p, 0)
        for _ in range(n):
            l, i = leb(p, i); mod = p[i:i + l].decode(); i += l
            l, i = leb(p, i); name = p[i:i + l].decode(); i += l
            k = p[i]; i += 1
            if k == 0: _, i = leb(p, i)
            elif k == 1: i += 1; i = limits(p, i)
            elif k == 2: i = limits(p, i)
            elif k == 3: i += 2
            elif k == 4: i += 1; _, i = leb(p, i)
            out.append((mod, name))
    return out

def exports(path):
    b = open(path, 'rb').read(); out = []
    for sid, p in sections(b):
        if sid != 7:
            continue
        n, i = leb(p, 0)
        for _ in range(n):
            l, i = leb(p, i); name = p[i:i + l].decode(); i += l; i += 1; _, i = leb(p, i); out.append(name)
    return out

def main(argv):
    verbose = '-v' in argv
    args = [a for a in argv if a != '-v']
    solver, modules = args[0], [m for m in args[1:] if not os.path.basename(m).startswith('solver')]
    present = set(exports(solver))
    glue = open(solver.replace('.wasm', '.js')).read()
    m = re.search(r'wasmImports=\{(.*?)\};', glue, re.S)
    glue_keys = set(re.findall(r'([A-Za-z_][A-Za-z0-9_]*):', m.group(1))) if m else set()
    skip = {'__memory_base', '__table_base', '__stack_pointer', 'memory', '__indirect_function_table', '__heap_base'}
    need, missing = {}, {}
    for w in modules:
        n = os.path.basename(w)[:-5]
        imp = {s for mo, s in imports(w) if mo in ('env', 'GOT.mem', 'GOT.func')}
        for s in imp - set(exports(w)) - skip:
            if s.startswith('invoke_'):
                continue
            # a symbol the reference build exports is needed even when the
            # glue also names it: getTempRet0/setTempRet0 are wasm exports the
            # glue merely forwards, and dropping them broke every filter that
            # returns a 64-bit value through them
            if s in present:
                need.setdefault(s, []).append(n)
            elif s not in glue_keys:
                missing.setdefault(s, []).append(n)
    for s in sorted(need):
        line = "    '_%s'" % s
        if verbose:
            line += "   # " + ", ".join(need[s])
        print(line)
    print("# %d symbols; %d imports no build of the solver defines (never called, or the module is not meant for this solver): %s"
          % (len(need), len(missing), " ".join(sorted(missing)[:8]) + (" ..." if len(missing) > 8 else "")), file=sys.stderr)

if __name__ == '__main__':
    main(sys.argv[1:])
