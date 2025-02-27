'use server';
import User from '@/db-schemas/User';
import { connectDB } from '@/lib/mongoose';
import bcrypt from 'bcryptjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const register = async (values: any) => {
  const { email, password, name } = values;
  try {
    await connectDB();
    const userFound = await User.findOne({ email });
    if (userFound) {
      return {
        error: 'Email already exists!'
      };
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword
    });
    await user.save();
  } catch (e) {
    console.log(e);
  }
};
