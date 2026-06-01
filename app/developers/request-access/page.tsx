import PageHeader from "@/components/shared/PageHeader";

export default function RequestAccessPage() {
  return (
    <>
      <PageHeader
        label="Developers"
        title="Get API access."
        intro="Tell us a bit about what you are building. We provision sandbox credentials within one business day."
      />
      <section className="bg-white">
        <div className="max-w-[640px] mx-auto px-6 py-20">
          <form
            action="mailto:research@pierflow.com"
            method="post"
            encType="text/plain"
            className="space-y-5"
          >
            <Field label="Your name" name="name" />
            <Field label="Work email" name="email" type="email" />
            <Field label="Company" name="company" />
            <Field label="Company website" name="website" />
            <div>
              <label className="block text-[12px] font-medium text-textl-primary mb-1.5">
                What are you building on Pierflow?
              </label>
              <textarea
                name="use_case"
                rows={5}
                className="w-full rounded-md border border-[#ddd] px-3 py-2.5 text-[14px] text-textl-primary placeholder:text-[#aaa] focus:outline-none focus:border-accent-teal"
              />
            </div>
            <Field label="Expected monthly volume" name="volume" />
            <button
              type="submit"
              className="text-[13px] font-medium px-4 py-2.5 rounded-md bg-accent-teal text-white hover:opacity-90"
            >
              Request access
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
}: {
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-textl-primary mb-1.5">
        {label}
      </label>
      <input
        name={name}
        type={type}
        className="w-full rounded-md border border-[#ddd] px-3 py-2.5 text-[14px] text-textl-primary placeholder:text-[#aaa] focus:outline-none focus:border-accent-teal"
      />
    </div>
  );
}
