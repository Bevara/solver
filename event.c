#include <gpac/main.h>
#include <gpac/filters.h>

GF_Err evt_ret_val;
extern GF_FilterSession *session;
//void cleanup_file_io();

static u32 enable_reports = 0;
static u32 enable_graph = 0;
static u32 enable_nonConnected = 0;
static u32 enable_stats = 0;
static u32 enable_callbck = 0;

static void bevara_print_report(GF_FilterSession *fsess, Bool is_init, Bool is_final)
{
	u32 i, count, nb_active;
	GF_SystemRTInfo rti;

	gf_sys_get_rti(100, &rti, 0);

	fprintf(stderr, "mem % 10" LLD_SUF " kb CPU % 2d", rti.gpac_memory / 1000, rti.process_cpu_time);
	fprintf(stderr, "\n");

	gf_fs_lock_filters(fsess, GF_TRUE);
	nb_active = count = gf_fs_get_filters_count(fsess);
	for (i = 0; i < count; i++)
	{
		GF_FilterStats stats;
		gf_fs_get_filter_stats(fsess, i, &stats);
		if (stats.done || stats.filter_alias)
		{
			nb_active--;
			continue;
		}

		fprintf(stderr, "%s", stats.name ? stats.name : stats.reg_name);

		if (stats.name && strcmp(stats.name, stats.reg_name))
			fprintf(stderr, " (%s)", stats.reg_name);
		fprintf(stderr, ": ");

		if (stats.status)
		{
			fprintf(stderr, "%s\n", stats.status);
		}
		else
		{
			if (stats.stream_type)
				fprintf(stderr, "%s ", gf_stream_type_name(stats.stream_type));
			if (stats.codecid)
				fprintf(stderr, "(%s) ", gf_codecid_name(stats.codecid));

			if ((stats.nb_pid_in == stats.nb_pid_out) && (stats.nb_pid_in == 1))
			{
				Double pck_per_sec = (Double)(stats.nb_hw_pck_sent ? stats.nb_hw_pck_sent : stats.nb_pck_sent);
				pck_per_sec *= 1000000;
				pck_per_sec /= (stats.time_process + 1);

				fprintf(stderr, "% 10" LLD_SUF " pck %02.02f FPS ", (s64)stats.nb_out_pck, pck_per_sec);
			}
			else
			{
				if (stats.nb_pid_in)
					fprintf(stderr, "%d input PIDs % 10" LLD_SUF " pck ", stats.nb_pid_in, (s64)stats.nb_in_pck);
				if (stats.nb_pid_out)
					fprintf(stderr, "%d output PIDs % 10" LLD_SUF " pck ", stats.nb_pid_out, (s64)stats.nb_out_pck);
			}
			if (stats.in_eos)
				fprintf(stderr, "- EOS");
			fprintf(stderr, "\n");
		}
	}
	fprintf(stderr, "Active filters: %d\n", nb_active);
}

static void bevara_print_graph(GF_FilterSession *fsess, Bool is_init, Bool is_final)
{
	gf_fs_print_connections(session);
}

static void bevara_print_stats(GF_FilterSession *fsess, Bool is_init, Bool is_final)
{
	gf_fs_print_stats(session);
}

static void bevara_print_nonConnected(GF_FilterSession *fsess, Bool is_init, Bool is_final)
{
	gf_fs_print_non_connected(session);
}

static Bool bevara_event_proc(void *opaque, GF_Event *event)
{
	GF_FilterSession *fsess = (GF_FilterSession *)opaque;
	if ((event->type == GF_EVENT_PROGRESS) && (event->progress.progress_type == 3))
	{
		if (enable_reports)
			bevara_print_report(session, GF_TRUE, GF_FALSE);

		if (enable_graph)
			bevara_print_graph(fsess, GF_FALSE, GF_FALSE);

		if (enable_stats)
			bevara_print_stats(fsess, GF_FALSE, GF_FALSE);

		if (enable_nonConnected)
			bevara_print_nonConnected(fsess, GF_FALSE, GF_FALSE);
	}
	else if (event->type == GF_EVENT_QUIT)
	{
		if (event->message.error > 0)
			evt_ret_val = event->message.error;
		gf_fs_abort(fsess, GF_FS_FLUSH_ALL);
	}
	return GF_FALSE;
}

void checkCallback()
{
	if (enable_reports || enable_graph || enable_stats || enable_nonConnected)
	{
		gf_fs_set_ui_callback(session, bevara_event_proc, session);
		gf_fs_enable_reporting(session, GF_TRUE);
	}
	else
	{
		gf_fs_enable_reporting(session, GF_FALSE);
	}
}

u32 getStats()
{
	return enable_stats;
}

u32 getReports()
{
	return enable_reports;
}

void printConnections(int value)
{
	enable_graph = value;
	checkCallback();
}

void printNonConnected(int value)
{
	enable_nonConnected = value;
	checkCallback();
}

void printStats(int value)
{
	enable_stats = value;
	checkCallback();
}

void printReports(int value)
{
	enable_reports = value;
	checkCallback();
}

void sendPlay()
{
	u32 i, count;
	count = gf_fs_get_filters_count(session);
	for (i = 0; i < count; i++)
	{
		GF_Filter *filter;
		filter = gf_fs_get_filter(session, i);
		if (gf_filter_is_sink(filter))
		{
			GF_FilterPid *pid = gf_filter_get_ipid(filter, 0);
			GF_FilterEvent fevt;
			GF_FEVT_INIT(fevt, GF_FEVT_PLAY, NULL);
			gf_filter_pid_send_event(pid, &fevt);
		}
	}
}

void sendPause()
{
	u32 i, count;
	count = gf_fs_get_filters_count(session);
	for (i = 0; i < count; i++)
	{
		GF_Filter *filter;
		filter = gf_fs_get_filter(session, i);
		if (gf_filter_is_sink(filter))
		{
			GF_FilterPid *pid = gf_filter_get_ipid(filter, 0);
			GF_FilterEvent fevt;
			GF_FEVT_INIT(fevt, GF_FEVT_STOP, NULL);
			gf_filter_pid_send_event(pid, &fevt);
		}
	}
}

void sendVolume(const char *vol)
{
	gf_fs_send_update(session, "aout", NULL, "vol", vol, 0);
}

u32 getVolume()
{
	return 0;
}

GF_FilterPid *getFirstPidSink()
{
	u32 i, count;
	count = gf_fs_get_filters_count(session);
	for (i = 0; i < count; i++)
	{
		GF_Filter *filter;
		filter = gf_fs_get_filter(session, i);
		if (gf_filter_is_sink(filter))
		{
			return gf_filter_get_ipid(filter, 0);
		}
	}
	return NULL;
}

u32 getWidth()
{
	u32 width = 0;
	GF_FilterPid *ipid = getFirstPidSink();
	if (ipid)
	{
		const GF_PropertyValue *p = gf_filter_pid_get_property(ipid, GF_PROP_PID_WIDTH);
		return p->value.uint;
	}

	return 0;
}

u32 getHeight()
{
	u32 width = 0;
	GF_FilterPid *ipid = getFirstPidSink();
	if (ipid)
	{
		const GF_PropertyValue *p = gf_filter_pid_get_property(ipid, GF_PROP_PID_HEIGHT);
		return p->value.uint;
	}

	return 0;
}

void destroy()
{
	gf_fs_del(session);
	//cleanup_file_io();
}
