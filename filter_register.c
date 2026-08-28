
#include <emscripten/emscripten.h>
#include <gpac/filters.h>

#include "filter_register.h"


#define MAX_BUILTIN_FILTERS 200
static BuiltinReg BuiltinFilters[MAX_BUILTIN_FILTERS];
static u32 nb_builtin_filters = 0;

void gf_fs_reg_all(GF_FilterSession *fsess, GF_FilterSession *a_sess){
    u32 i, count = nb_builtin_filters;
    for (i = 0; i < count; i++) {
        const GF_FilterRegister *freg = BuiltinFilters[i].fun(a_sess);
        if (freg) gf_fs_add_filter_register(fsess, freg);
    }
}


GF_EXPORT
void gf_filter_auto_register(const char *name, filter_reg_fun fun) {
    if (nb_builtin_filters < MAX_BUILTIN_FILTERS) {
        BuiltinFilters[nb_builtin_filters].name = name;
        BuiltinFilters[nb_builtin_filters].fun = fun;
        nb_builtin_filters++;
    }
}
