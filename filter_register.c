
#include <emscripten/emscripten.h>
#include <gpac/filters.h>

void gf_fs_reg_all(GF_FilterSession *fsess, GF_FilterSession *a_sess){
	MAIN_THREAD_EM_ASM({
		libgpac.gf_fs_reg_all($0,$1);
	}, fsess, a_sess);
}
