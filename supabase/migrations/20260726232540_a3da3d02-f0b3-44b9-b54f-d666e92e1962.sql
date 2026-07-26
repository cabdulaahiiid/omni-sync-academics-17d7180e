CREATE POLICY "trainer_registry DH read multi-dept"
ON public.trainer_registry
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'DH'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.trainer_departments td
    WHERE td.trainer_registry_id = public.trainer_registry.id
      AND td.department_id = public.current_department_id()
  )
);