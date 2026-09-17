package compose

import (
	"example.com/app/internal/delivery"
)

func init() {
	Prepare = func(executable string) error {
		paths := delivery.BesideExecutable(executable)
		return paths.Prepare()
	}
}
