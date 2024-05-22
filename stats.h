void set_filter_stats(GF_FilterSession *fsess, GF_Filter *filter);

const char* get_filter_status();

const char* get_stream_type();

const char* get_codecid();

uint32_t is_in_eos();

uint32_t nb_in_packet();

uint32_t nb_out_packet();