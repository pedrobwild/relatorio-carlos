ALTER FUNCTION public.check_stock_balance_indexes() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.check_stock_balance_indexes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_stock_balance_indexes() TO authenticated;