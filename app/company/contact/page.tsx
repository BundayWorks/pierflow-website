import PageHeader from "@/components/shared/PageHeader";

export default function ContactPage() {
  return (
    <>
      <PageHeader
        label="Contact"
        title="Talk to us."
        intro="Tell us a little about what you are building. We will get back to you within one business day."
      />
      <section className="bg-white">
        <div className="max-w-[640px] mx-auto px-6 py-20">
          <form
            action="mailto:research@pierflow.com"
            method="post"
            encType="text/plain"
            className="space-y-5"
          >
            <Field label="Name" name="name" />
            <Field label="Work email" name="email" type="email" />
            <Field label="Company" name="company" />
            <div>
              <label className="block text-[12px] font-medium text-textl-primary mb-1.5">
                What are you building?
              </label>
              <textarea
                name="message"
                rows={5}
                className="w-full rounded-md border border-[#ddd] px-3 py-2.5 text-[14px] text-textl-primary placeholder:text-[#aaa] focus:outline-none focus:border-accent-teal"
              />
            </div>
            <button
              type="submit"
              className="text-[13px] font-medium px-4 py-2.5 rounded-md bg-accent-teal text-white hover:opacity-90"
            >
              Send message
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-[#eee] text-[14px] text-textl-secondary">
            Or email{" "}
            <a
              href="mailto:research@pierflow.com"
              className="text-accent-teal hover:underline"
            >
              research@pierflow.com
            </a>
          </div>
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
