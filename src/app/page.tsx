"use client";

import { Search } from "./components/search";
import { searchModel } from "./models/searchModel";
import { useState } from "react";
import { redirect } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Progress } from "./components/progress";

export default function Index() {
  const [wines, setWines] = useState(new Array<searchModel>());

  const onSelected = (wine: searchModel) => {
    setWines([...wines, wine]);
  };
  const { status } = useSession();
  const router = useRouter();

  const showSession = () => {
    if (status === "authenticated") {
      return (
        <button
          className="border border-solid border-black rounded"
          onClick={() => {
            signOut({ redirect: false }).then(() => {
              router.push("/");
            });
          }}
        >
          Sign Out
        </button>
      );
    } else if (status === "loading") {
      return <Progress />;
    } else {
      return (
        <Link
          href="/login"
          className="border border-solid border-black rounded"
        >
          Sign In
        </Link>
      );
    }
  };
  return (
    <>
      <nav className="bottom"></nav>
      <div>
        <h3>Smak på vin</h3>
        {showSession()}
        <Search onWineSelected={onSelected} />
        {wines.map((x) => (
          <button
            className="responsive primary"
            key={x.productId}
            onClick={() => redirect(`/smaking/${x.productId}`)}
          >
            {x.productShortName}
          </button>
        ))}
      </div>
    </>
  );
}
