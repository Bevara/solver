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

Once built, you can use and distribute solver_1.js and solver_1.wasm with your universal tags.

## Documentation

For more details, please visit our documentation at https://bevara.com/documentation/develop/.

## Publishing it as a runtime

`solver.json` makes this directory a **runtime** for the Bevara registry: the
main module that accessors link against, named by pages as `using="solver_1"`.

```bash
source <emsdk 6.0.8>/emsdk_env.sh      # third_parties/emsdk_vers.txt
bevara publish --build                  # builds .bevara/.build/solver_1.js and .wasm, signs, uploads
```

The version is the generation (`set(VERSION "1")` in CMakeLists.txt), the
licence comes from `LICENCE`, and the built-in filters from `loader.js`.
Filters whose `"using"` names `solver_1` can only be published once this
runtime is.

## Provenance of lib/libgpac_static.a

The static GPAC library is prebuilt. It reports `GPAC 26.08-DEV` with the
revision string `release`, so the exact GPAC commit is not recorded in the
binary. It is presumably built from the player's GPAC tree
(`filters/third_parties/gpac`, commit 5a9988d13 at the time of writing) -
**to confirm**, with the configure options, before relying on a published
build for compliance.
