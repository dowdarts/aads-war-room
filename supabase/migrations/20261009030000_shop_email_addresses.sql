-- Email routing for the store:
--   * customers receive mail FROM shop@aadsdarts.com (Resend-verified domain);
--     their replies go to cgcdarts@gmail.com (contact_email is used as reply-to
--     and shown on the site, matching the custom apparel ad);
--   * e-Transfers and admin notifications stay with dow1800@gmail.com.
UPDATE public.shop_settings SET value = '"CGC Darts Custom Apparel <shop@aadsdarts.com>"', updated_at = now() WHERE key = 'email_from';
UPDATE public.shop_settings SET value = '"cgcdarts@gmail.com"', updated_at = now() WHERE key = 'contact_email';
UPDATE public.shop_settings SET value = '"dow1800@gmail.com"', updated_at = now() WHERE key IN ('etransfer_email', 'admin_notify_email');
