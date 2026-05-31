import { createClient } from './client';

const apiObj = {
  chats: {
    getChats: async (args: any) => {
      const supabase = createClient();
      const { data, error } = await supabase.from('chats').select('*').order('update_time', { ascending: false });
      if (error) throw error;
      return data;
    },
    getChatById: async (args: { id: string }) => {
      if (!args || !args.id) return null;
      const supabase = createClient();
      const { data, error } = await supabase.from('chats').select('*').eq('id', args.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    deleteChat: async (args: { id: string }) => {
       const supabase = createClient();
       await supabase.from('chats').delete().eq('id', args.id);
    },
    updateChat: async (args: any) => {
       const supabase = createClient();
       const { id, ...updates } = args;
       await supabase.from('chats').update(updates).eq('id', id);
    }
  },
  messages: {
    getMessages: (args: { chatId: string }) => {
      return {
         fetch: async () => {
            if (!args || !args.chatId) return [];
            const supabase = createClient();
            const { data } = await supabase.from('messages').select('*').eq('chat_id', args.chatId).order('update_time', { ascending: true });
            return data || [];
         },
         subscribe: (callback: Function) => {
            if (!args || !args.chatId) return { unsubscribe: () => {} };
            const supabase = createClient();
            const sub = supabase.channel(`messages:${args.chatId}`)
              .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${args.chatId}` }, () => {
                 supabase.from('messages').select('*').eq('chat_id', args.chatId).order('update_time', { ascending: true })
                   .then(({data}) => callback(data || []));
              })
              .subscribe();
            return {
               unsubscribe: () => supabase.removeChannel(sub)
            };
         }
      }
    },
    getLastAssistantMessage: async (args: any) => {
       return null;
    }
  },
  users: {
     store: async (args: any) => { 
        // Sync user logic if needed
     },
  },
  userCustomization: {
     getUserCustomization: async (args: any) => {
        const supabase = createClient();
        // Uses RLS for user isolation
        const { data } = await supabase.from('user_customization').select('*').single();
        return data || null;
     },
     saveUserCustomization: async (args: any) => {
        const supabase = createClient();
        await supabase.from('user_customization').upsert(args);
     }
  },
  notes: {
     listNotes: async (args: any) => {
        const supabase = createClient();
        const { data } = await supabase.from('notes').select('*').order('updated_at', { ascending: false });
        return data || [];
     },
     deleteNote: async (args: { noteId: string }) => {
        const supabase = createClient();
        await supabase.from('notes').delete().eq('note_id', args.noteId);
     }
  },
  files: {
     generateUploadUrl: async () => {
        return "supabase-storage-url-mock"; // Storage refactor later
     }
  },
  chatStreams: {
     prepareForNewStream: async (args: any) => {}
  },
  fileActions: {
     saveSandboxGeneratedFile: async (args: any) => ({ url: "mock", fileId: "mock", tokens: 0 })
  }
};

export const api: any = new Proxy(apiObj, {
  get(target: any, prop: string) {
    if (prop in target) return target[prop];
    return new Proxy({}, {
      get() {
        return async () => ({});
      }
    });
  }
});

export class ConvexHttpClient {
   constructor(url: string) {}
   async query(apiFn: any, args: any) { return apiFn(args); }
   async mutation(apiFn: any, args: any) { return apiFn(args); }
   async action(apiFn: any, args: any) { return apiFn(args); }
}
