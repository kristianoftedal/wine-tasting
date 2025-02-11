"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { register } from "@/actions/register";
export default function Register() {
  const [error, setError] = useState<string>();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    const r = await register({
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
    });
    ref.current?.reset();
    if (r?.error) {
      setError(r.error);
      return;
    } else {
      return router.push("/login");
    }
  };

  return (
    <section className="center-align middle-align">
      <form ref={ref} action={handleSubmit} className="padding">
        {error && <div className="">{error}</div>}
        <h3 style={{ marginBottom: "16px" }}>Registrer deg</h3>

        <div class="field label border">
          <input type="text" placeholder="Navn" className="" name="name" />
          <label>Navn</label>
        </div>
        <div class="field label border">
          <input type="email" placeholder="Email" className="" name="email" />
          <label>Email</label>
        </div>

        <div class="field label border">
          <input type="password" placeholder="Password" name="password" />
          <label>Password</label>
        </div>
        <button className="primary">Registrer</button>

        <Link href="/login">Har du allerede en konto?</Link>
      </form>
    </section>
  );
}
