"use client";

import { useSession } from "next-auth/react";
import { Progress } from "./progress";
import Image from "next/image";

export default function AppBar() {
  const { status } = useSession();

  const loginStatus = () => {
    if (status === "authenticated") {
      return (
        <button
          className="padding border small-round"
          onClick={() => {
            signOut({ redirect: false }).then(() => {
              router.push("/");
            });
          }}
        >
          Logg ut
        </button>
      );
    } else if (status === "loading") {
      return <Progress />;
    } else {
      return (
        <button
          onClick={() => router.push("/login")}
          className="border small-round"
        >
          Login
        </button>
      );
    }
  };

  return (
    <header>
      <nav>
        <button className="circle transparent">
          <Image
            alt="app bar image"
            className="responsive"
            src="/images/icon.png"
            width={50}
            height={50}
          />
        </button>
        <h5 className="max center-align">Smak Vin!</h5>
        {loginStatus()}
      </nav>
    </header>
  );
}
