"use client";

import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function AppBar() {
  const { status, data } = useSession();
  const router = useRouter();

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
          Logg ut {data?.user?.name}
        </button>
      );
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
        <button className="circle transparent" onClick={() => router.push("/")}>
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
        <button className="circle transparent">
          <i className="extra">person</i>
        </button>
        {/* <button className="circle transparent">
          <i>menu</i>
        </button> */}
      </nav>
    </header>
  );
}
