# k8s – OKE deploy (CD pipeline)

Manifests applied by **CD - Deploy SPROJ to OKE** after CI pushes images to GHCR.

## Required GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret | Purpose |
|--------|--------|
| `OCI_PRIVATE_KEY` | OCI API key PEM (full contents) |
| `OCI_USER_OCID` | User OCID |
| `OCI_FINGERPRINT` | Key fingerprint |
| `OCI_TENANCY_OCID` | Tenancy OCID |
| `OCI_REGION` | e.g. `us-phoenix-1` |
| `OKE_CLUSTER_OCID` | OKE cluster OCID |
| `GHCR_USERNAME` | GitHub username (lowercase, same as used for packages) |
| `GHCR_PAT` | PAT with `read:packages` |
| `JWT_SECRET` | Backend auth (long random string); CD creates cluster secret from this |

## After deploy

Point **api.agriqual.xyz** to the Ingress external IP:  
`kubectl get ingress -n sproj-app`
