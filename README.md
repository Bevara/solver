# Solver
The solver select an optimal arrangement of filters to decode a given source. 

## Requirements

[CMake](https://cmake.org/) is used as a build system. To install it, follow
[Debian build instructions](developing_in_debian.md).

[Emscripten SDK](https://emscripten.org/) is required for building
WebAssembly artifacts. To install it, follow the
[Download and Install](https://emscripten.org/docs/getting_started/downloads.html)
guide:

```bash
cd $OPT

# Get the emsdk repo.
git clone https://github.com/emscripten-core/emsdk.git

# Enter that directory.
cd emsdk

# Download and install the latest SDK tools.
./emsdk install latest

# Make the "latest" SDK "active" for the current user. (writes ~/.emscripten file)
./emsdk activate latest
```

## Building the solver

```bash
# Setup EMSDK and other environment variables. In practice EMSDK is set to be
# $OPT/emsdk.
source $OPT/emsdk/emsdk_env.sh

# Assuming you are in the root level of the cloned repo :
emcmake cmake .
emmake make
```

Once built, you can use and distribute mm_solver_1.0.5.js and mm_solver_1.0.5.wasm with your universal tags.

## Documentation

For more details, please visit our documentation at https://bevara.com/documentation/develop/.

## Publishing it as a runtime

`solver.json` makes this directory a **runtime** for the Bevara registry: the
main module that accessors link against, named by pages as `using="mm_solver_1.0.5"`.

```bash
source <emsdk 7.0.0>/emsdk_env.sh      # third_parties/emsdk_vers.txt
bevara publish --build                  # builds .bevara/.build/mm_solver_1.0.5.js and .wasm, signs, uploads
```

The version is the generation (`set(VERSION "1")` in CMakeLists.txt), the
licence comes from `LICENCE`, and the built-in filters from `loader.js`.
Filters whose `"using"` names `mm_solver_1.0.5` can only be published once this
runtime is.

## Provenance of lib/libgpac_static.a

The static GPAC library is prebuilt and checked in. It no longer has unknown
provenance: it is built from this repo's own GPAC tree
(`filters/third_parties/gpac`, branch `raw`, commit ac8085445) with

```bash
emconfigure <gpac>/configure --enable-pic --use-xvid=no --disable-qjs \
  --use-png=no --use-jpeg=no --disable-ogg --use-vorbis=no \
  --extra-libs=-sERROR_ON_UNDEFINED_SYMBOLS=0
emmake make lib
cp bin/gcc/libgpac_static.a <player>/solver/lib/
```

which is what `filters/third_parties/build_thirdparties.sh` passes, under the
Emscripten release named in `filters/third_parties/emsdk_vers.txt`. Rebuild it
and copy it here whenever that tree or that toolchain moves, otherwise the
solver links yesterday's GPAC.

## Compatibility with the accessors

An accessor's `"using"` list is a statement of fact, not a wish: it names the
runtimes that accessor is known to load with. The registry, the CLI
(`resolvePipeline`, `findSolver`) and the Showcase's registry check all read it
as such, so a wrong entry breaks pages silently - the `avif` demo asked
`mm_solver_minimal_1.0.1` to load two accessors whose lists did not include it,
and died in `reportUndefinedSymbols`.

A new runtime version is added to an accessor's list in one of two ways only:

- **the accessor is rebuilt against it and tested**, which also records the
  emsdk it was built with; or
- **the runtime's dynamic-linking surface is shown unchanged** from a version
  the accessor already lists - same exports, same imports, same table and
  memory - in which case the existing binary is republished with the extended
  list (`scripts/republish-using.js` in Bevara-filter-manager), keeping its
  original emsdk in the manifest rather than stamping the current one.

1.0.5 was declared compatible the second way: 2887 exports, 388 imports,
`memory` and `__indirect_function_table` identical to 1.0.4, as checked with
`WebAssembly.Module.exports/imports` on both binaries before any list was
touched. What changed between the two is inside the main module (the
emscripten download manager), which a side module never links.
