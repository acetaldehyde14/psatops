package com.psap.palletisation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class PalletisationApplication {
    public static void main(String[] args) {
        SpringApplication.run(PalletisationApplication.class, args);
    }
}
