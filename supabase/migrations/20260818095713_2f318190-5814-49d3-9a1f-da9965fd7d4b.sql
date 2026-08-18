REVOKE ALL ON FUNCTION public.ct_assert_version(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ct_ips_start_review(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ct_ips_decide_request(uuid, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ct_ips_delegate_request(uuid, uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ct_pd_start_review(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ct_pd_decide_request(uuid, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ct_pd_bulk_return_to_ips(uuid[], text, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ct_assert_version(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ct_ips_start_review(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ct_ips_decide_request(uuid, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ct_ips_delegate_request(uuid, uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ct_pd_start_review(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ct_pd_decide_request(uuid, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ct_pd_bulk_return_to_ips(uuid[], text, jsonb) TO authenticated, service_role;