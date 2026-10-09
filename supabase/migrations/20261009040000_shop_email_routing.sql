-- The app is the middle man for all email:
--   * customers get mail FROM shop@aadsdarts.com and reply TO shop@aadsdarts.com;
--   * admin alerts go to cgcdarts@gmail.com, sent from invoice@aadsdarts.com
--     (new orders) and custom@aadsdarts.com (design requests) so Gmail filters
--     can auto-label them;
--   * e-Transfers stay with dow1800@gmail.com.
INSERT INTO public.shop_settings (key, value, is_public, description) VALUES
  ('reply_to_email',       '"shop@aadsdarts.com"',                             false, 'Reply-to address on every customer email'),
  ('email_from_orders',    '"CGC Darts Invoices <invoice@aadsdarts.com>"',     false, 'Sender for new-order alerts to the admin'),
  ('email_from_inquiries', '"CGC Darts Custom <custom@aadsdarts.com>"',        false, 'Sender for new design-request alerts to the admin')
ON CONFLICT (key) DO NOTHING;
UPDATE public.shop_settings SET value = '"cgcdarts@gmail.com"', updated_at = now() WHERE key = 'admin_notify_email';
UPDATE public.shop_settings SET value = '"CGC Darts Custom Apparel <shop@aadsdarts.com>"', updated_at = now() WHERE key = 'email_from';
UPDATE public.shop_settings SET value = '"dow1800@gmail.com"', updated_at = now() WHERE key = 'etransfer_email';
