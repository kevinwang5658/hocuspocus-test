import { Server } from "@hocuspocus/server";
import {
  onAuthenticatePayload,
  onConnectPayload,
  onStoreDocumentPayload
} from "@hocuspocus/server/dist/packages/server/src/types";
import {createClient} from "@supabase/supabase-js";
import 'dotenv/config';
import { Database } from "@hocuspocus/extension-database";
import * as jose from 'jose';

// Supabase
export const createSupabaseClient = (accessToken: string) => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )
}


// Configure the server …
const server = new Server({
  port: 3001,
  async onAuthenticate(data: onAuthenticatePayload): Promise<any> {
    const { token } = data;

    try {
      const userJwt = jose.decodeJwt(token);
      const {
        sub: userId,
        email: email,
      } = userJwt;

      // You can set contextual data to use it in other hooks
      return {
        userId,
        email,
        token
      };
    } catch (error) {

    }
  },

  async onConnect(data: onConnectPayload): Promise<void> {
    console.log(`New connection ${data.socketId}`);
  },

  extensions: [
    new Database({
      fetch: async ({ documentName, context }) => {
        const supabase = createSupabaseClient(context.token);

        const row = await supabase.from('documents')
          .select('*')
          .eq('id', documentName)
          .eq('user_id', context.userId)

        return (row.data.length > 0 && row.data[0].blob)
          ? Buffer.from(row.data[0].blob.slice(2), 'hex')
          : null;
      },
      store: async ({ documentName, state, context, document }) => {
        console.log(`store ${documentName}`);

        const supabase = createSupabaseClient(context.token);
        await supabase.from('documents')
          .update({
            blob: '\\x' + state.toString('hex'),
          })
          .eq('id', documentName)
          .eq('user_id', context.userId)
      }
    })
  ]
});

// … and run it!
server.listen();
