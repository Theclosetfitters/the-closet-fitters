// Posts to the sign-out route handler, which clears the Supabase session
// server-side and redirects home. Works without client JS.
export default function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="rounded-full border border-zinc-300 px-4 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100"
      >
        Sign out
      </button>
    </form>
  );
}
