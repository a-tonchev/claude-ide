import useQuery from '@/components/connections/hooks/useQuery';

const useQueryValue = (defaultValue, paramName = 'param') => {
  const params = useQuery();

  return params[paramName] ?? defaultValue;
};

export default useQueryValue;
