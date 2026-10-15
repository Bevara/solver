cmake_minimum_required(VERSION 3.7)

# Built on its own (bevara publish --build, or emcmake cmake -S . -B build), it
# sets what the player's top-level CMakeLists.txt sets when it includes this
# directory with add_subdirectory().
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(solver C CXX)
  if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)    # as the player is configured
  endif()
  set(CMAKE_CXX_STANDARD 20)
  set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR})
  add_definitions(-fpic)
endif()

set(VERSION "1")

set(USE_DEBUG "-g")
set(USE_OPT "-O3")

if(DEBUG_MODE)
  set(USE_FLAGS "${USE_DEBUG}")
else()
  set(USE_FLAGS "${USE_OPT}")
endif()

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${USE_FLAGS}")
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${USE_FLAGS}")

add_definitions(-fpic)

add_compile_definitions(GPAC_HAVE_CONFIG_H GPAC_DISABLE_DOC)

include(exports.cmake)

SET(SOLVER_SRC
  event.c
  filter_register.c
  properties.cpp
  stats.c
  gpac.c
  gpac_help.c
  compositor_tools.c
)

SET(EXTERNAL_RUNTIME
  # wasmMemory, wasmTable, HEAPU32 : mesure de l'empreinte memoire des side
  # modules par le chargeur (loader.js, timings.mem)
  "['stringToUTF8','UTF8ToString','stackAlloc','addFunction','allocateUTF8OnStack','stackSave','getTempRet0','setTempRet0','FS','cwrap','ccall','setValue','lengthBytesUTF8','HEAPU8','HEAPU32','wasmMemory','wasmTable']"
)

add_executable(solver_${VERSION} ${SOLVER_SRC})

SET(JS_RUNTIME
  ${CMAKE_CURRENT_SOURCE_DIR}/loader.js
)

set_target_properties( solver_${VERSION}
                            PROPERTIES
                                #LINK_FLAGS "${USE_FLAGS} -s FETCH -s USE_ZLIB=1 -s USE_SDL=2 -s USE_FREETYPE=1 -s MAIN_MODULE=2 -s TOTAL_MEMORY=128MB --no-entry -s MODULARIZE=1 -s --extern-post-js=${JS_RUNTIME} EXPORTED_RUNTIME_METHODS=${EXTERNAL_RUNTIME} -s EXPORTED_FUNCTIONS=${EXTERNAL_FN} -s ERROR_ON_UNDEFINED_SYMBOLS=0"
                                LINK_FLAGS "${USE_FLAGS} -sALLOW_MEMORY_GROWTH -sMAIN_MODULE=2 -sEXPORT_NAME=libgpac -sUSE_ZLIB=1 -sUSE_SDL=2 -sUSE_FREETYPE=1 -sTOTAL_MEMORY=128MB -sSTACK_SIZE=5MB --no-entry -sMODULARIZE=1 -sEXPORTED_FUNCTIONS=[${EXPORTED_FUNCTIONS}] --extern-post-js=${JS_RUNTIME} -sEXPORTED_RUNTIME_METHODS=${EXTERNAL_RUNTIME} -sERROR_ON_UNDEFINED_SYMBOLS=0 -Wl,--export=getTempRet0 -Wl,--export=setTempRet0 -Wl,--export=sched_yield -Wl,--export=exit -Wl,--export=__cxa_begin_catch -Wl,--export=__cxa_find_matching_catch_2 -Wl,--export=__cxa_find_matching_catch_3 -Wl,--export=__cxa_throw -Wl,--export=__resumeException -Wl,--export=_Znam -Wl,--export=_ZdaPv -Wl,--export=__cxa_atexit"
                                )



target_link_libraries(solver_${VERSION}
  ${CMAKE_CURRENT_SOURCE_DIR}/lib/libgpac_static.a
)

target_include_directories(solver_${VERSION} PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/include
)
