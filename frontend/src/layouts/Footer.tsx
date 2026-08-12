const Footer = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  return (
    <footer className="d-footer bg-card border-t border-black/5 dark:border-white/5 py-6 px-[22px] mt-[auto]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="mb-0 text-sm text-neutral-500 dark:text-neutral-400">
          &copy; {currentYear} AgencyOS. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
