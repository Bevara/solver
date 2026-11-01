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
static u32 enable_time = 0;

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
		//the playback position is read from the outputs' reports (getCurrentTime)
		gf_fs_enable_reporting(session, enable_time ? GF_TRUE : GF_FALSE);
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

/* Pausing goes through the speed of the outputs, as gpac's own player does:
 * vout and aout turn speed 0 into GF_FEVT_PAUSE upstream and stop presenting,
 * and the next non-zero speed into GF_FEVT_RESUME, so playback carries on
 * where it was. A STOP sent on their input pids, as was done before, left
 * vout presenting frames, so the picture never froze. A session without one
 * of the two outputs only gets a warning for it. */
static void setOutputSpeed(const char *speed)
{
	gf_fs_send_update(session, "vout", NULL, "speed", speed, 0);
	gf_fs_send_update(session, "aout", NULL, "speed", speed, 0);
}

void sendPlay()
{
	setOutputSpeed("1");
}

void sendPause()
{
	setOutputSpeed("0");
}

/* Seeking, as gpac's own player does: an update of the outputs' start makes
 * each send STOP then PLAY from that time upstream. While paused (speed 0),
 * vout applies it on resume. */
void sendSeek(const char *start)
{
	gf_fs_send_update(session, "vout", NULL, "start", start, 0);
	gf_fs_send_update(session, "aout", NULL, "start", start, 0);
}

/* The output of the session registered as `name` (vout, aout), with its
 * statistics, or NULL. Called with the filters locked. */
static GF_Filter *findOutput(const char *name, GF_FilterStats *stats)
{
	u32 i, count = gf_fs_get_filters_count(session);
	for (i = 0; i < count; i++)
	{
		GF_Filter *filter = gf_fs_get_filter(session, i);
		if (!gf_filter_is_sink(filter) || gf_filter_get_stats(filter, stats) != GF_OK)
			continue;
		if (stats->reg_name && !strcmp(stats->reg_name, name))
			return filter;
	}
	return NULL;
}

/* The time of the last frame (or audio block) an output presented, from the
 * "time=<cts>/<timescale>" of its report: vout and aout publish it only while
 * the session reports, which the first call turns on. */
static Bool outputTime(const char *name, Double *time)
{
	GF_FilterStats stats;
	Bool found = GF_FALSE;
	gf_fs_lock_filters(session, GF_TRUE);
	if (findOutput(name, &stats) && stats.status)
	{
		const char *at = strstr(stats.status, "time=");
		u64 cts;
		u32 timescale;
		if (at && (sscanf(at, "time=" LLU "/%u", &cts, &timescale) == 2) && timescale)
		{
			*time = (Double)cts / timescale;
			found = GF_TRUE;
		}
	}
	gf_fs_lock_filters(session, GF_FALSE);
	return found;
}

//seconds, -1 while unknown
Double getCurrentTime()
{
	Double time;
	if (!session)
		return -1;
	if (!enable_time)
	{
		enable_time = 1;
		checkCallback();
	}
	if (outputTime("vout", &time) || outputTime("aout", &time))
		return time;
	return -1;
}

//seconds, -1 when the source does not say (a live stream, a raw stream)
Double getDuration()
{
	const char *outputs[] = {"vout", "aout"};
	Double duration = -1;
	u32 i;
	if (!session)
		return -1;
	gf_fs_lock_filters(session, GF_TRUE);
	for (i = 0; (i < 2) && (duration < 0); i++)
	{
		GF_FilterStats stats;
		GF_Filter *filter = findOutput(outputs[i], &stats);
		GF_FilterPid *ipid = filter ? gf_filter_get_ipid(filter, 0) : NULL;
		const GF_PropertyValue *p = ipid ? gf_filter_pid_get_property(ipid, GF_PROP_PID_DURATION) : NULL;
		if (p && p->value.lfrac.den && p->value.lfrac.num > 0)
			duration = (Double)p->value.lfrac.num / p->value.lfrac.den;
	}
	gf_fs_lock_filters(session, GF_FALSE);
	return duration;
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
	/* session can already be NULL/deleted by the time JS calls this -
	 * see the matching comment in solver_minimal/event.c: gpac.c's own
	 * main() nulls this global once it tears the session down normally,
	 * and calling gf_fs_del() again here would double-free it. */
	if (session) {
		gf_fs_del(session);
		session = NULL;
	}
	//cleanup_file_io();
}
