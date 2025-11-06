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
      accessToken: async () => {
        return accessToken;
      },
    }
  )
}


// Configure the server …
const server = new Server({
  port: 3001,
  async onAuthenticate(data: onAuthenticatePayload): Promise<any> {
    const { token } = data;

    const userJwt = jose.decodeJwt(token);
    const {
      sub: userId,
      email: email,
    } = userJwt;

    const supabase = createSupabaseClient(token);

    const { data: [grants] } = await supabase
      .rpc('get_user_document_permissions', { document_id: data.documentName })
      .throwOnError();

    const { data: ownerRes } = await supabase.from('documents')
      .select('owner')
      .eq('id', data.documentName)
      .maybeSingle()
      .throwOnError();

    // User cannot see the document at all (restricted by RLS). They are not authorized
    if (!ownerRes) {
      throw new Error('User is not authorized to see this document')
    }

    if (!grants.read && userId !== ownerRes.owner) {
      throw new Error('User is not authorized to see this document')
    }

    if (!grants.write && userId !== ownerRes.owner) {
      data.connectionConfig.readOnly = true;
    }

    // You can set contextual data to use it in other hooks
    return {
      userId,
      email,
      token
    };
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
          .throwOnError();

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
          .throwOnError();
      }
    })
  ]
});

// … and run it!
server.listen();
