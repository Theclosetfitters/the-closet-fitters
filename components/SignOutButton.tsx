// Posts to the sign-out route handler, which clears the Supabase session
// server-side and redirects home. Works without client JS.
export default function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="text-cream/80 transition hover:text-cream"
      >
        Sign out
      </button>
    </form>
  );
}
