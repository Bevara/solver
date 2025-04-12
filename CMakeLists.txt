set (THIRD_PARTIES ${CMAKE_SOURCE_DIR}/filters/third_parties)
set (THIRD_PARTIES_BINARIES ${CMAKE_BINARY_DIR}/filters/third_parties)
set (GPAC_LOCATION ${THIRD_PARTIES}/gpac)
set (GPAC_BINARIES ${THIRD_PARTIES_BINARIES}/gpac)

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
)

SET(EXTERNAL_RUNTIME
  "['stringToUTF8','UTF8ToString','stackAlloc','addFunction','allocateUTF8OnStack','stackSave','getTempRet0','setTempRet0','FS','cwrap','ccall']"
)

add_executable(solver_${VERSION} ${SOLVER_SRC})

SET(JS_RUNTIME
  ${CMAKE_CURRENT_SOURCE_DIR}/loader.js
)

set_target_properties( solver_${VERSION}
                            PROPERTIES
                                #LINK_FLAGS "${USE_FLAGS} -s FETCH -s USE_ZLIB=1 -s USE_SDL=2 -s USE_FREETYPE=1 -s MAIN_MODULE=2 -s TOTAL_MEMORY=128MB --no-entry -s MODULARIZE=1 -s --extern-post-js=${JS_RUNTIME} EXPORTED_RUNTIME_METHODS=${EXTERNAL_RUNTIME} -s EXPORTED_FUNCTIONS=${EXTERNAL_FN} -s ERROR_ON_UNDEFINED_SYMBOLS=0"
                                LINK_FLAGS "${USE_FLAGS} -pthread -sALLOW_MEMORY_GROWTH -sWASM_BIGINT -s MAIN_MODULE=2 -s EXPORT_NAME=libgpac -s USE_ZLIB=1 -s USE_SDL=2 -s USE_FREETYPE=1 -s TOTAL_MEMORY=128MB --no-entry -s MODULARIZE=1 -s EXPORTED_FUNCTIONS=[${EXPORTED_FUNCTIONS}] -s --extern-post-js=${JS_RUNTIME} EXPORTED_RUNTIME_METHODS=${EXTERNAL_RUNTIME} -s ERROR_ON_UNDEFINED_SYMBOLS=0"
                                )



target_link_libraries(solver_${VERSION}
  ${CMAKE_CURRENT_SOURCE_DIR}/lib/libgpac_static.a
)

target_include_directories(solver_${VERSION} PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_directories(solver_${VERSION} PRIVATE
${GPAC_BINARIES}/bin/gcc)
