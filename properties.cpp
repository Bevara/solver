#include "rapidjson/document.h"

#include <rapidjson/stringbuffer.h>
#include <rapidjson/writer.h>

using namespace rapidjson;

StringBuffer sb;

extern "C"
{
  struct GF_FilterSession;
  struct GF_FilterRegister;
  struct GF_Filter;
  struct GF_FilterPid;
  struct GF_List;
  struct GF_PropertyValue;
  struct GF_FilterStats;

  extern GF_FilterSession *session;

  GF_List *gf_list_new();
  void gf_list_del(GF_List *ptr);
  uint32_t gf_list_count(const GF_List *ptr);
  uint32_t gf_list_add(GF_List *ptr, void *item);
  int32_t gf_list_find(GF_List *ptr, void *item);
  void *gf_list_pop_front(GF_List *ptr);
  int32_t gf_list_del_item(GF_List *ptr, void *item);

  uint32_t gf_filter_is_source(GF_Filter *filter);
  uint32_t gf_filter_is_sink(GF_Filter *filter);

  uint32_t getWidth();
  uint32_t getHeight();
  
  void printConnections(int);
  void printNonConnected(int);
  void printStats(int);
  uint32_t getStats();
  uint32_t getReports();
  uint32_t getVolume();
  void printReports(int);
  void sendPlay();
  void sendPause();
  void sendVolume(const char *);
  
  
  GF_Filter *gf_fs_get_filter(GF_FilterSession *session, uint32_t idx);
  uint32_t gf_fs_filters_registers_count(GF_FilterSession *fsess);
  uint32_t gf_fs_get_filters_count(GF_FilterSession *session);
  GF_FilterRegister *gf_fs_get_filter_register(GF_FilterSession *fsess, uint32_t idx);
  const char *gf_fs_filters_registers_name(GF_FilterRegister *reg);
  const char *gf_filter_get_name(GF_Filter *filter);
  uint32_t gf_filter_get_opid_count(GF_Filter *filter);
  GF_FilterPid *gf_filter_get_opid(GF_Filter *filter, uint32_t idx);
  uint32_t gf_filter_get_ipid_count(GF_Filter *filter);
  GF_FilterPid *gf_filter_get_ipid(GF_Filter *filter, uint32_t idx);
  GF_Filter *gf_filter_pid_enum_destinations(GF_FilterPid *pid, uint32_t idx);
  const char *gf_filter_pid_get_name(GF_FilterPid *pid);
  const GF_PropertyValue *gf_filter_pid_get_property(GF_FilterPid *PID, uint32_t prop_4cc);
  void gf_fs_lock_filters(GF_FilterSession *session, uint32_t do_lock);
  void gf_fs_enable_reporting(GF_FilterSession *session, uint32_t reporting_on);


  #include "stats.h"
  
  void print_filter_outputs(GF_Filter *f, Document *nodes, Document *links, Document::AllocatorType &allocator, GF_List *filters_done, GF_FilterPid *pid, GF_Filter *alias_for)
  {
    uint32_t i = 0;
    Document node;
    node.SetObject();
    Value name(gf_filter_get_name(f), allocator);
    node.AddMember(Value("name"), name, allocator);
    // node.AddMember(Value("index"), Value(idx), allocator);

    if (gf_filter_is_source(f))
    {
      node.AddMember(Value("group"), Value(0), allocator);
    }
    else if (gf_filter_is_sink(f))
    {
      node.AddMember(Value("group"), Value(2), allocator);
    }
    else
    {
      node.AddMember(Value("group"), Value(1), allocator);
    }

    nodes->PushBack(node, allocator);

    if (filters_done && (gf_list_find(filters_done, f) >= 0))
      return;

    if (filters_done)
      gf_list_add(filters_done, f);

    GF_List *dests = gf_list_new();
    for (i = 0; i < gf_filter_get_opid_count(f); i++)
    {
      uint32_t j, k;

      GF_FilterPid *pidout = gf_filter_get_opid(f, i);
      for (j = 0; gf_filter_pid_enum_destinations(pidout, j) != NULL; j++)
      {
        GF_Filter *f_dest = gf_filter_pid_enum_destinations(pidout, j);
        gf_list_add(dests, f_dest);
      }
    }

    while (gf_list_count(dests))
    {
      GF_Filter *dest = (GF_Filter *)gf_list_pop_front(dests);
      GF_List *pids = gf_list_new();
      uint32_t max_name_len = 0;
      uint32_t num_tile_pids = 0;
      for (i = 0; i < gf_filter_get_opid_count(f); i++)
      {
        uint32_t j;
        GF_FilterPid *pidout = gf_filter_get_opid(f, i);
        for (j = 0; gf_filter_pid_enum_destinations(pidout, j) != NULL; j++)
        {
          GF_Filter *f = gf_filter_pid_enum_destinations(pidout, j);
          if (f != dest)
            continue;
          gf_list_add(pids, gf_filter_get_ipid(f, 0));
        }
      }

      int32_t nb_pids_print = gf_list_count(pids);
      if (nb_pids_print == 1)
        nb_pids_print = 0;
      if (num_tile_pids)
        nb_pids_print -= num_tile_pids - 1;
      int32_t nb_final_pids = nb_pids_print;
      if (nb_pids_print)
        nb_pids_print++;

      for (i = 0; i < gf_filter_get_opid_count(f); i++)
      {
        uint32_t j, k;

        GF_FilterPid *pidout = gf_filter_get_opid(f, i);

        for (j = 0; gf_filter_pid_enum_destinations(pidout, j) != NULL; j++)
        {
          GF_Filter *alias = NULL;
          GF_Filter *fout = gf_filter_pid_enum_destinations(pidout, j);
          if (fout != dest)
            continue;

          gf_list_del_item(pids, gf_filter_get_ipid(f, 0));
          if (nb_pids_print && !gf_list_count(pids))
            nb_pids_print = 0;

          for (k = 0; gf_filter_pid_enum_destinations(pidout, k) != NULL; k++)
          {
            alias = gf_filter_pid_enum_destinations(pidout, k);
            if (alias == fout)
              break;
            alias = NULL;
          }

          Document link;
          link.SetObject();
          Value source_name(gf_filter_get_name(f), allocator);
          link.AddMember(Value("source"), source_name, allocator);

          if (alias)
          {

            Value target_name(gf_filter_get_name(alias), allocator);
            link.AddMember(Value("target"), target_name, allocator);
            links->PushBack(link, allocator);
            print_filter_outputs(alias, nodes, links, allocator, filters_done, pidout, fout);
          }
          else
          {
            Value target_name(gf_filter_get_name(fout), allocator);
            link.AddMember(Value("target"), target_name, allocator);
            links->PushBack(link, allocator);
            print_filter_outputs(fout, nodes, links, allocator, filters_done, pidout, NULL);
          }

          if (nb_pids_print)
            nb_pids_print++;
        }
      }
      gf_list_del(pids);
    }
    gf_list_del(dests);
  }

  const char *get_properties(const char *json)
  {
    Document document;
    document.Parse(json);
    assert(document.IsArray());

    Document out;
    Document::AllocatorType &r = out.GetAllocator();
    out.SetObject();

    for (Value::ConstValueIterator itr = document.Begin(); itr != document.End(); ++itr)
    {
      if (itr->IsString())
      {

        const char *property = itr->GetString();

        if (strcmp(property, "width") == 0)
        {
          out.AddMember(Value("width"), Value(getWidth()), out.GetAllocator());
        }
        else if (strcmp(property, "height") == 0)
        {
          out.AddMember(Value("height"), Value(getHeight()), out.GetAllocator());
        }
        else if (strcmp(property, "reports") == 0)
        {
          out.AddMember(Value("reports"), Value(getReports() ? true : false), out.GetAllocator());
        }
        else if (strcmp(property, "volume") == 0)
        {
          out.AddMember(Value("volume"), Value(getVolume()), out.GetAllocator());
        }
        else if (strcmp(property, "registered") == 0)
        {
          uint32_t i, count;

          Document registered;
          registered.SetArray();

          count = gf_fs_filters_registers_count(session);
          for (i = 0; i < count; i++)
          {
            GF_FilterRegister *registered_filter = gf_fs_get_filter_register(session, i);
            Value reg_name(gf_fs_filters_registers_name(registered_filter), r);
            registered.PushBack(reg_name, r);
          }

          out.AddMember(Value("registered"), registered, out.GetAllocator());
        }
        else if (strcmp(property, "connected") == 0)
        {
          uint32_t i, count;

          Document connected;
          connected.SetArray();

          count = gf_fs_get_filters_count(session);
          for (i = 0; i < count; i++)
          {
            GF_Filter *filter = gf_fs_get_filter(session, i);
            Value filter_name(gf_filter_get_name(filter), r);
            connected.PushBack(filter_name, r);
          }

          out.AddMember(Value("connected"), connected, out.GetAllocator());
        }
        else if (strcmp(property, "graph") == 0)
        {
          uint32_t i, count;
          Document graph;
          Document nodes;
          Document links;
          GF_List *filters_done;

          graph.SetObject();
          nodes.SetArray();
          links.SetArray();

          filters_done = gf_list_new();

          count = gf_fs_get_filters_count(session);
          gf_fs_lock_filters(session, 1);

          for (i = 0; i < count; i++)
          {
            GF_Filter *filter = gf_fs_get_filter(session, i);

            if (gf_filter_get_ipid_count(filter) > 0)
              continue;

            if (gf_filter_get_opid_count(filter) == 0)
              continue;

            print_filter_outputs(filter, &nodes, &links, out.GetAllocator(), filters_done, NULL, NULL);
          }

          gf_fs_lock_filters(session, 0);

          gf_list_del(filters_done);

          graph.AddMember(Value("nodes"), nodes, out.GetAllocator());
          graph.AddMember(Value("links"), links, out.GetAllocator());
          out.AddMember(Value("graph"), graph, out.GetAllocator());
        }else if (strcmp(property, "stats") == 0){
            uint32_t i, count;
            Document stats;
            stats.SetObject();

            count = gf_fs_get_filters_count(session);

            for (i = 0; i < count; i++)
            {
              Document stat;
              stat.SetObject();

              GF_Filter *filter = gf_fs_get_filter(session, i);
              Value filter_name(gf_filter_get_name(filter), r);

              set_filter_stats(session, filter);
              const char* filter_status = get_filter_status();
              if(filter_status != NULL){
                stat.AddMember(Value("Status"), Value(filter_status, out.GetAllocator()), out.GetAllocator());
              }

              if (get_stream_type() != NULL){
                stat.AddMember(Value("Stream type"), Value(get_stream_type(), out.GetAllocator()), out.GetAllocator());
              }
              
              if (get_codecid() != NULL){
                stat.AddMember(Value("Codec ID"), Value(get_codecid(), out.GetAllocator()), out.GetAllocator());
              }
              
              //stat.AddMember(Value("EOS"), Value(is_in_eos() == 1? Type::kTrueType :  Type::kFalseType), out.GetAllocator());

              if (gf_filter_get_ipid_count(filter) >0){
                stat.AddMember(Value("Number of inputs"), Value(gf_filter_get_ipid_count(filter)), out.GetAllocator());
                stat.AddMember(Value("Number of input packets"), Value(nb_in_packet()), out.GetAllocator());
              }

              if (gf_filter_get_opid_count(filter) >0){
                stat.AddMember(Value("Number of outputs"), Value(gf_filter_get_opid_count(filter)), out.GetAllocator());
                stat.AddMember(Value("Number of output packets"), Value(nb_out_packet()), out.GetAllocator());
              }
              
              stats.AddMember(filter_name, stat, out.GetAllocator());
            }

            out.AddMember(Value("stats"), stats, out.GetAllocator());
        }
      }
    }

    sb.Clear();
    Writer<StringBuffer> writer(sb);
    out.Accept(writer);
    return sb.GetString();
  }

  const char *set_properties(const char *json)
  {
    Document document;
    document.Parse(json);
    assert(document.IsObject());

    Document out;
    out.SetObject();

    if (document.HasMember("connections"))
    {
      assert(document["connections"].IsBool());
      const bool connections = document["connections"].GetBool();

      if (connections)
      {
        printConnections(1);
      }
      else
      {
        printConnections(0);
      }
    }

    if (document.HasMember("nonConnected"))
    {
      assert(document["nonConnected"].IsBool());
      const bool nonConnected = document["nonConnected"].GetBool();

      if (nonConnected)
      {
        printNonConnected(1);
      }
      else
      {
        printNonConnected(0);
      }
    }

    if (document.HasMember("enable_reporting"))
    {
      assert(document["enable_reporting"].IsBool());
      const bool enable_reporting = document["enable_reporting"].GetBool();
      gf_fs_enable_reporting(session, enable_reporting? 1 :0);
    }

    if (document.HasMember("reports"))
    {
      assert(document["reports"].IsBool());
      const bool stats = document["reports"].GetBool();

      if (stats)
      {
        printReports(1);
      }
      else
      {
        printReports(0);
      }
    }

    if (document.HasMember("play"))
    {
      assert(document["play"].IsBool());
      const bool play = document["play"].GetBool();

      if (play)
      {
        sendPlay();
      }
    }

    if (document.HasMember("pause"))
    {
      assert(document["pause"].IsBool());
      const bool pause = document["pause"].GetBool();

      if (pause)
      {
        sendPause();
      }
    }

    if (document.HasMember("volume"))
    {
      assert(document["volume"].IsString());
      const char *vol = document["volume"].GetString();

      sendVolume(vol);
    }

    sb.Clear();
    Writer<StringBuffer> writer(sb);
    out.Accept(writer);
    return sb.GetString();
  }
}
