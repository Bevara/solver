
#include <gpac/main.h>
#include <gpac/filters.h>

extern GF_FilterSession *session;

GF_FilterStats stats;

void set_filter_stats(GF_FilterSession *fsess, GF_Filter *filter){
	gf_fs_lock_filters(fsess, GF_TRUE);
	gf_filter_get_stats(filter, &stats);
	gf_fs_lock_filters(fsess, GF_FALSE);
}

const char* get_filter_status(){
	return stats.status;
}

const char* get_stream_type(){
	const char* name = gf_stream_type_name(stats.stream_type);

	if(strcmp(name, "Unknown") == 0)
		return NULL;

	return name;
}

const char* get_codecid(){
	const char* name = gf_codecid_name(stats.codecid);

	if(strcmp(name, "Codec Not Supported") == 0)
		return NULL;

	return name;
}

u32 is_in_eos(){
	return stats.in_eos == GF_TRUE? 1 :0;
}

u32 nb_in_packet(){
	return stats.nb_in_pck;
}

u32 nb_out_packet(){
	return stats.nb_out_pck;
}