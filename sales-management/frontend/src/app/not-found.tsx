import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Lỗi 404
        </p>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Không tìm thấy trang</h1>
        <p className="max-w-md text-muted-foreground">
          Đường dẫn bạn truy cập không tồn tại hoặc đã được đổi. Kiểm tra URL hoặc quay về trang chủ.
        </p>
      </div>
      <Button asChild>
        <Link href="/" aria-label="Về trang chủ">
          Về trang chủ
        </Link>
      </Button>
    </div>
  )
}
