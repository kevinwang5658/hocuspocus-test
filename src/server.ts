import { Server } from "@hocuspocus/server";
import {onConnectPayload, onStoreDocumentPayload} from "@hocuspocus/server/dist/packages/server/src/types";
import {createClient} from "@supabase/supabase-js";
import 'dotenv/config';
import {Database as SupabaseTypes } from "./database.types";
import { Database } from "@hocuspocus/extension-database";

// Supabase
const supabase = createClient<SupabaseTypes>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Configure the server …
const server = new Server({
  port: 3000,
  async onConnect(data: onConnectPayload): Promise<void> {
    console.log(`New connection ${data.socketId}`);
  },

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const row = await supabase.from('documents')
          .select('*')

        return row.data.length > 0
          ? Buffer.from(row.data[0].blob.slice(2), 'hex')
          : null;
      },
      store: async ({ documentName, state }) => {
        console.log('store');

        await supabase.from('documents')
          .insert({
            name: documentName,
            blob: '\\x' + state.toString('hex')
          })
      }
    })
  ]
});

// … and run it!
server.listen();