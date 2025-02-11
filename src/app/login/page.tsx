"use client";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const res = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    if (res?.error) {
      setError(res.error as string);
    }
    if (res?.ok) {
      return router.push("/");
    }
  };

  return (
    <section className="center-align middle-align">
      <form className="padding" onSubmit={handleSubmit}>
        <div>
          {error && <div className="text-black">{error}</div>}
          <h3 style={{ marginBottom: "16px" }}>Logg inn</h3>
          <div class="field label border">
            <input type="email" placeholder="Email" name="email" />
            <label>Email</label>
          </div>
          <div class="field label border">
            <input
              type="password"
              placeholder="Password"
              className=""
              name="password"
            />
            <label>Password</label>
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <button className="primary">Logg inn</button>
            <Link href="/register" className="border">
              Opprett konto
            </Link>
            <Link href="/register" className="border">
              Fortsett uten innlogging
            </Link>
          </div>
        </div>
      </form>
    </section>
  );
}
