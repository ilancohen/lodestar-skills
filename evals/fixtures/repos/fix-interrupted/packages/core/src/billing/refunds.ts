import { httpClient } from "@repo/api";

export function refund(id: string) {
  return httpClient.post(`/refunds/${id}`);
}
