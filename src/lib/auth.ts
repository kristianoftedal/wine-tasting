import User from '@/db-schemas/User';
import { connectDB } from '@/lib/mongoose';
import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import credentials from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    credentials({
      name: 'Credentials',
      id: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        await connectDB();
        const user = await User.findOne({
          email: credentials?.email
        }).select('+password');
        if (!user) throw new Error('Wrong Email');
        const passwordMatch = await bcrypt.compare(credentials!.password, user.password);
        if (!passwordMatch) throw new Error('Wrong Password');
        return user;
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token;
        token.id = user?.id;
      }
      return token;
    },
    session({ session, token }) {
      // I skipped the line below coz it gave me a TypeError
      // session.accessToken = token.accessToken;
      session.user.id = token.id;

      return session;
    }
  }
};
